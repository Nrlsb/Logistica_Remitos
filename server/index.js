const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const { parseRemitoPdf } = require('./pdfParser');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const path = require('path');

// ... (existing imports)

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// Basic Route (API check)
app.get('/api/health', (req, res) => {
    res.send('Control de Remitos API Running');
});

// ... (API Routes)

// The catch-all handler must be at the end, after all other routes
// app.get('*', (req, res) => {
//    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
// });


// Middleware to verify token
const verifyToken = async (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify session is still valid in DB
        const { data: user, error } = await supabase
            .from('users')
            .select('current_session_id')
            .eq('id', decoded.id)
            .single();

        if (error || !user) {
            return res.status(401).json({ message: 'Usuario no encontrado' });
        }

        if (user.current_session_id !== decoded.session_id) {
            return res.status(401).json({ message: 'Tu sesión ha sido cerrada porque se inició sesión en otro dispositivo.' });
        }

        req.user = decoded;
        next();
    } catch (e) {
        console.error('Token verification error:', e.message);
        res.status(401).json({ message: 'Token no válido' });
    }
};

// API Routes

// Get product by barcode
app.get('/api/products/:barcode', verifyToken, async (req, res) => {
    const { barcode } = req.params;
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`code.eq.${barcode},barcode.eq.${barcode}`)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // Not found
                return res.status(404).json({ message: 'Product not found' });
            }
            throw error;
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get all preparers (Public/Authenticated)
app.get('/api/public/preparers', verifyToken, async (req, res) => {
    try {
        // Fetch all users and filter in memory since JSONB/Array filtering in Supabase via JS client can be tricky depending on structure
        // Or better, just fetch all users tasks and filter.
        const { data: users, error } = await supabase
            .from('users')
            .select('username, user_code, tasks')
            .order('username');

        if (error) throw error;

        // Filter users who have 'Preparador' in their tasks array
        const preparers = users.filter(user =>
            Array.isArray(user.tasks) && user.tasks.includes('Preparador')
        );

        res.json(preparers);
    } catch (error) {
        console.error('Error fetching preparers:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Create new remito
app.post('/api/remitos', verifyToken, async (req, res) => {
    const { remitoNumber, items, discrepancies, clarification, preparedBy } = req.body;

    if (!remitoNumber || !items || items.length === 0) {
        return res.status(400).json({ message: 'Missing remito number or items' });
    }

    try {
        const { data, error } = await supabase
            .from('remitos')
            .insert([
                {
                    remito_number: remitoNumber,
                    items: items,
                    discrepancies: discrepancies || {}, // Save discrepancies if provided
                    clarification: clarification || null,
                    status: 'scanned', // Initial status
                    created_by: req.user.username, // Save the username from the token
                    prepared_by: preparedBy || null // Save the preparer
                }
            ])
            .select();

        if (error) throw error;

        // Update pre-remito status to 'processed'
        // We don't await the result strictly for the response, but it should happen
        await supabase
            .from('pre_remitos')
            .update({ status: 'processed' })
            .eq('order_number', remitoNumber);

        res.status(201).json(data[0]);
    } catch (error) {
        console.error('Error creating remito:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update remito (generic)
app.patch('/api/remitos/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { total_packages, status } = req.body;

    const updates = {};
    if (total_packages !== undefined) {
        updates.total_packages = total_packages;
        updates.packages_added_by = req.user.username;
    }
    if (status) {
        updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
    }

    try {
        const { data, error } = await supabase
            .from('remitos')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json(data[0]);
    } catch (error) {
        console.error('Error updating remito:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get all remitos with manual join to pre-remitos/PV
app.get('/api/remitos', verifyToken, async (req, res) => {
    try {
        // 1. Fetch all processed remitos
        const { data: remitosData, error: remitosError } = await supabase
            .from('remitos')
            .select('*')
            .order('date', { ascending: false });

        if (remitosError) throw remitosError;

        // 2. Fetch all pre-remitos with PV info
        const { data: preRemitosData, error: preRemitosError } = await supabase
            .from('pre_remitos')
            .select(`
                order_number,
                pedidos_ventas (
                    numero_pv,
                    cliente_tienda,
                    cliente_codigo,
                    cliente_nombre
                )
            `);

        if (preRemitosError) throw preRemitosError;

        // 3. Create a lookup map for speed
        const preRemitoMap = {};
        preRemitosData.forEach(pre => {
            const pv = pre.pedidos_ventas?.[0];
            preRemitoMap[pre.order_number] = {
                numero_pv: pv?.numero_pv || '-',
                sucursal: pv?.cliente_tienda || '-', // Map DB cliente_tienda to frontend sucursal
                cliente_codigo: pv?.cliente_codigo || '-',
                cliente_nombre: pv?.cliente_nombre || '-'
            };
        });

        // 4. Merge data
        const formattedData = remitosData.map(remito => {
            const extraInfo = preRemitoMap[remito.remito_number] || {
                numero_pv: '-',
                sucursal: '-',
                cliente_codigo: '-',
                cliente_nombre: '-'
            };
            return {
                ...remito,
                numero_pv: extraInfo.numero_pv,
                sucursal: extraInfo.sucursal,
                cliente_codigo: extraInfo.cliente_codigo,
                cliente_nombre: extraInfo.cliente_nombre
            };
        });

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching remitos:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// ... (skipping generic remito by ID)

// Get all pre-remitos (for selection list)
// Get all pre-remitos (for selection list) with PV info
app.get('/api/pre-remitos', verifyToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pre_remitos')
            .select(`
                id, 
                order_number, 
                created_at,
                pedidos_ventas (
                    numero_pv,
                    cliente_tienda,
                    cliente_codigo,
                    cliente_nombre
                )
            `)
            .neq('status', 'processed') // Filter out processed orders
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Flatten the structure for easier frontend consumption
        const formattedData = data.map(item => ({
            ...item,
            numero_pv: item.pedidos_ventas?.[0]?.numero_pv || null,
            sucursal: item.pedidos_ventas?.[0]?.cliente_tienda || null, // Map DB cliente_tienda to frontend sucursal
            cliente_codigo: item.pedidos_ventas?.[0]?.cliente_codigo || null,
            cliente_nombre: item.pedidos_ventas?.[0]?.cliente_nombre || null
        }));

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching pre-remitos:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get pre-remito by order number
app.get('/api/pre-remitos/:orderNumber', verifyToken, async (req, res) => {
    const { orderNumber } = req.params;
    try {
        const { data, error } = await supabase
            .from('pre_remitos')
            .select(`
                *,
                pedidos_ventas (
                    numero_pv,
                    cliente_tienda,
                    cliente_codigo,
                    cliente_nombre
                )
            `)
            .eq('order_number', orderNumber)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // Not found
                return res.status(404).json({ message: 'Pre-remito not found' });
            }
            throw error;
        }

        // Flatten info
        const responseData = {
            ...data,
            numero_pv: data.pedidos_ventas?.[0]?.numero_pv || null,
            sucursal: data.pedidos_ventas?.[0]?.cliente_tienda || null, // Map DB cliente_tienda to frontend sucursal
            cliente_codigo: data.pedidos_ventas?.[0]?.cliente_codigo || null,
            cliente_nombre: data.pedidos_ventas?.[0]?.cliente_nombre || null,
            pedidos_ventas: undefined // Remove the array
        };

        res.json(responseData);
    } catch (error) {
        console.error('Error fetching pre-remito:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Protheus Web Service - Receive Pre-Remito
app.post('/api/protheus/pre-remito', async (req, res) => {
    // Note: detailed validation/auth should be added. Assuming internal trusted network or adding generic secret later.
    const { header, details } = req.body;

    // Expected payload structure based on user request:
    // header: { numero_pv, numero_pre_remito, codigo_cliente, tienda_cliente, nombre_cliente }
    // details: [ { item, codigo_producto, descripcion, cantidad } ]

    if (!header || !header.numero_pre_remito || !details) {
        return res.status(400).json({ message: 'Invalid payload: Missing header or details' });
    }

    try {
        // 1. Upsert Pre-Remito
        const preRemitoData = {
            order_number: header.numero_pre_remito,
            items: details.map(d => ({
                code: d.codigo_producto,
                description: d.descripcion,
                quantity: d.cantidad,
                item_number: d.item // Optionally store the item number from Protheus
            })),
            status: 'pending' // Default status
        };

        const { data: preRemito, error: preError } = await supabase
            .from('pre_remitos')
            .upsert(preRemitoData, { onConflict: 'order_number' })
            .select();

        if (preError) throw preError;

        // 2. Upsert Pedido Venta (PV) linkage
        if (header.numero_pv) {
            const pvData = {
                numero_pv: header.numero_pv,
                pre_remito_asociado: header.numero_pre_remito,
                cliente_tienda: header.tienda_cliente, // Map input tienda_cliente to DB cliente_tienda
                cliente_codigo: header.codigo_cliente,
                cliente_nombre: header.nombre_cliente
            };

            // Manual Upsert Logic to avoid ON CONFLICT constraint issues
            const { data: existingPV } = await supabase
                .from('pedidos_ventas')
                .select('id')
                .eq('numero_pv', header.numero_pv)
                .maybeSingle();

            if (existingPV) {
                const { error: updateError } = await supabase
                    .from('pedidos_ventas')
                    .update(pvData)
                    .eq('id', existingPV.id);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('pedidos_ventas')
                    .insert(pvData);
                if (insertError) throw insertError;
            }
        }

        res.status(200).json({ message: 'Pre-Remito received successfully', id: preRemito[0].id });

    } catch (error) {
        console.error('Error processing Protheus webhook:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Upload PDF Remito
// Upload PDF Remito
app.post('/api/remitos/upload-pdf', verifyToken, multer({ storage: multer.memoryStorage() }).single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        console.log(`Received PDF upload. Size: ${req.file.size} bytes`);
        const extractedItems = await parseRemitoPdf(req.file.buffer);

        // Enrich items with barcodes from DB
        const enrichedItems = [];
        for (const item of extractedItems) {
            const internalCode = String(item.code).trim();

            // Lookup product by internal code
            const { data: product } = await supabase
                .from('products')
                .select('barcode, description')
                .eq('code', internalCode)
                .maybeSingle(); // Use maybeSingle to avoid error if 0 rows (though unlikely with checking)

            if (product && product.barcode) {
                enrichedItems.push({
                    code: internalCode,
                    barcode: product.barcode,
                    quantity: item.quantity,
                    description: product.description || item.description
                });
            } else {
                enrichedItems.push({
                    code: internalCode,
                    barcode: null, // Frontend will fallback to code
                    quantity: item.quantity,
                    description: item.description
                });
            }
        }

        res.json({ items: enrichedItems });
    } catch (error) {
        console.error('Error processing PDF:', error);
        res.status(500).json({ message: 'Error processing PDF' });
    }
});

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ... (existing imports)

const { v4: uuidv4 } = require('uuid');

// ... (existing imports)

// Auth Routes

// Register
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        // Check if user exists
        const { data: existingUser, error: searchError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate Session ID
        const sessionId = uuidv4();

        // Create user
        const { data, error } = await supabase
            .from('users')
            .insert([
                {
                    username,
                    password: hashedPassword,
                    current_session_id: sessionId,
                    role: 'user' // Default role
                }
            ])
            .select();

        if (error) throw error;

        // Generate Token
        const token = jwt.sign(
            { id: data[0].id, username: data[0].username, role: data[0].role, session_id: sessionId },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({ token, user: { id: data[0].id, username: data[0].username, role: data[0].role } });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password, force } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        // Check if user exists
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check if session exists (and we act responsibly to block it unless forced)
        // If user.current_session_id is present, it means there is an active session presumably.
        // We can't know for sure if it's "active" (user might have closed tab), but for security/mutex we assume yes.
        if (user.current_session_id && !force) {
            return res.status(409).json({ message: 'Ya existe una sesión activa en otro dispositivo.' });
        }

        // Generate New Session ID
        const sessionId = uuidv4();

        // Update user with new session ID
        const { error: updateError } = await supabase
            .from('users')
            .update({ current_session_id: sessionId })
            .eq('id', user.id);

        if (updateError) throw updateError;

        // Generate Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, session_id: sessionId },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Example protected route
app.get('/api/auth/user', verifyToken, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, role, created_at')
            .eq('id', req.user.id)
            .single();

        if (error) throw error;
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Admin Routes for User Management

// Get all users (Admin only)
app.get('/api/users', verifyToken, async (req, res) => {
    // Check if user is admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, role, created_at, tasks')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Ensure tasks is an array if null
        const formattedUsers = users.map(user => ({
            ...user,
            tasks: user.tasks || []
        }));

        res.json(formattedUsers);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update user tasks (Admin only)
app.patch('/api/users/:id/tasks', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { tasks } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    if (!Array.isArray(tasks)) {
        return res.status(400).json({ message: 'Tasks must be an array' });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .update({ tasks: tasks })
            .eq('id', id)
            .select('id, username, role, tasks');

        if (error) throw error;

        res.json(data[0]);
    } catch (error) {
        console.error('Error updating user tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Create new user (Admin only)
app.post('/api/admin/users', verifyToken, async (req, res) => {
    // Check if user is admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { username, password, user_code, role } = req.body;

    // Basic validation
    if (!username || !password || !user_code || !role) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate user_code (must be exactly 3 digits)
    if (!/^\d{3}$/.test(user_code)) {
        return res.status(400).json({ message: 'User code must be exactly 3 digits' });
    }

    try {
        // Check if username already exists
        const { data: existingUser, error: searchError } = await supabase
            .from('users')
            .select('id')
            .or(`username.eq.${username},user_code.eq.${user_code}`)
            .maybeSingle();

        if (existingUser) {
            return res.status(400).json({ message: 'Username or User Code already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate Session ID
        const sessionId = uuidv4();

        // Create user
        const { data, error } = await supabase
            .from('users')
            .insert([
                {
                    username,
                    password: hashedPassword,
                    user_code,
                    role,
                    current_session_id: sessionId,
                    tasks: [] // Initialize empty tasks
                }
            ])
            .select('id, username, role, user_code, created_at');

        if (error) {
            if (error.code === '23505') { // Unique violation fallback
                return res.status(400).json({ message: 'Username or User Code already exists' });
            }
            throw error;
        }

        res.status(201).json(data[0]);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// The catch-all handler must be at the end, after all other routes
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
