import React, { useState, useEffect } from 'react';
import Scanner from './Scanner';
import Modal from './Modal';
import api from '../api';

const RemitoForm = () => {
    const [items, setItems] = useState([]);
    const [manualCode, setManualCode] = useState('');
    const [remitoNumber, setRemitoNumber] = useState('');
    const [isScanning, setIsScanning] = useState(false);

    // Pre-remito state
    const [preRemitoNumber, setPreRemitoNumber] = useState('');
    const [expectedItems, setExpectedItems] = useState(null); // null = no pre-remito loaded
    const [preRemitoStatus, setPreRemitoStatus] = useState(''); // 'loading', 'found', 'not_found', 'error'

    // Modal State
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const triggerModal = (title, message, type = 'info') => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            type
        });
    };

    const closeModal = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    // Refs to keep track of latest state without triggering re-renders in callbacks
    const itemsRef = React.useRef(items);
    const expectedItemsRef = React.useRef(expectedItems);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    useEffect(() => {
        expectedItemsRef.current = expectedItems;
    }, [expectedItems]);

    const handleLoadPreRemito = async () => {
        if (!preRemitoNumber) return;
        setPreRemitoStatus('loading');
        try {
            const response = await api.get(`/api/pre-remitos/${preRemitoNumber}`);
            setExpectedItems(response.data.items);
            setPreRemitoStatus('found');
            // Auto-fill remito number if desired, or keep separate
        } catch (error) {
            console.error('Error loading pre-remito:', error);
            setPreRemitoStatus('not_found');
            setExpectedItems(null);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setPreRemitoStatus('loading');
        try {
            const response = await api.post('/api/remitos/upload-pdf', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            const mappedItems = response.data.items.map(item => ({
                barcode: item.code,
                quantity: item.quantity,
                description: item.description
            }));

            setExpectedItems(mappedItems);
            setPreRemitoStatus('found');
        } catch (error) {
            console.error('Error uploading PDF:', error);
            triggerModal('Error', 'Error al procesar el PDF', 'error');
        }
    };

    const handleRemoveItem = (code) => {
        setItems(items.filter(item => item.code !== code));
    };

    const handleQuantityChange = (code, newQuantity) => {
        const qty = parseInt(newQuantity, 10);
        if (isNaN(qty) || qty < 1) return;

        setItems(prevItems => prevItems.map(item => {
            if (item.code === code) {
                // Re-validate
                let validationMessage = null;
                const expectedQty = getExpectedQty(code);
                if (expectedItems && expectedQty !== null) {
                    if (qty > expectedQty) {
                        validationMessage = 'Excede cantidad solicitada';
                    }
                }
                return { ...item, quantity: qty, validationError: validationMessage };
            }
            return item;
        }));
    };

    const handleSubmitRemito = async () => {
        try {
            // Calculate Discrepancies
            let discrepancies = { missing: [], extra: [] };

            if (expectedItems) {
                // Find Missing Items (Expected but not in scanned items or quantity mismatch)
                expectedItems.forEach(expected => {
                    const scanned = items.find(i => i.code === expected.barcode);
                    const scannedQty = scanned ? scanned.quantity : 0;

                    if (scannedQty < expected.quantity) {
                        discrepancies.missing.push({
                            code: expected.barcode,
                            description: expected.description,
                            expected: expected.quantity,
                            scanned: scannedQty
                        });
                    }
                });

                // Find Extra Items (Scanned but not in expected items OR quantity exceeds expected)
                items.forEach(scanned => {
                    const expected = expectedItems.find(i => i.barcode === scanned.code);

                    if (!expected) {
                        // Completely unexpected item
                        discrepancies.extra.push({
                            code: scanned.code,
                            description: scanned.name,
                            quantity: scanned.quantity
                        });
                    } else if (scanned.quantity > expected.quantity) {
                        // Expected item but with excess quantity
                        discrepancies.extra.push({
                            code: scanned.code,
                            description: scanned.name,
                            quantity: scanned.quantity - expected.quantity
                        });
                    }
                });
            }

            const response = await api.post('/api/remitos', {
                remitoNumber,
                items,
                discrepancies
            });

            console.log('Remito submitted:', response.data);
            triggerModal('Éxito', 'Remito guardado correctamente', 'success');

            // Reset form
            setItems([]);
            setRemitoNumber('');
            setExpectedItems(null);
            setPreRemitoNumber('');
            setPreRemitoStatus('');
        } catch (error) {
            console.error('Error submitting remito:', error);
            triggerModal('Error', 'Error al guardar el remito', 'error');
        }
    };

    // Handle barcode scan (from camera or physical scanner)
    const handleScan = React.useCallback((code) => {
        const currentItems = itemsRef.current;
        const currentExpectedItems = expectedItemsRef.current;

        // Validation Logic
        let validationMessage = null;
        let isValid = true;

        if (currentExpectedItems) {
            const expectedItem = currentExpectedItems.find(item => item.barcode === code);
            if (!expectedItem) {
                isValid = false;
                validationMessage = 'Producto no pertenece al pedido';
                // We cannot trigger modal here easily because it might interrupt scanning flow too much?
                // Or maybe we DO want to interrupt?
                // Since user asked for modals instead of alerts, let's use it.
                // BUT, we need to be careful about "this" context or closures if we used triggerModal directly.
                // Since triggerModal is state setter, it's stable? No, it depends on closure?
                // Actually, setModalConfig is stable. But triggerModal isn't if defined inside component.
                // However, we are inside useCallback. We shouldn't call external functions that change often.
                // Let's dispatch a custom event or use a ref for the trigger function?
                // Or just ignore the lint warning?
                // Better: Just set the validation message on the item.
                // The ALERT was: alert(`ALERTA: ${validationMessage}`);

                // If we want to show a modal, we need to call a function.
                // Let's assume we can call it. We might need to add it to deps or use a ref.
                // For simplicity, I will NOT show a modal for every scan error to avoid spamming,
                // UNLESS it's a critical error. The user saw alerts before.
                // Let's try to emit a custom event or just use console.warn for now?
                // NO, the user WANTS modals.
                // I will use a Ref to hold the triggerModal function to call it safely from useCallback.
            } else {
                // Check quantity
                const currentQty = currentItems.find(i => i.code === code)?.quantity || 0;
                if (currentQty + 1 > expectedItem.quantity) {
                    isValid = false;
                    validationMessage = 'Excede cantidad solicitada';
                }
            }
        }

        // We need to trigger modal if there is a validation message that warrants it.
        // The previous code did `alert`.
        // To call triggerModal from here without adding it to deps (which would break stability),
        // we can use a ref.

        if (validationMessage) {
            window.dispatchEvent(new CustomEvent('scan-error', { detail: validationMessage }));
        }

        const existingItem = currentItems.find(item => item.code === code);
        if (existingItem) {
            setItems(prevItems => prevItems.map(item =>
                item.code === code ? { ...item, quantity: item.quantity + 1, validationError: validationMessage } : item
            ));
        } else {
            // Fetch product details from backend
            api.get(`/api/products/${code}`)
                .then(response => {
                    const product = response.data;
                    setItems(prevItems => [...prevItems, {
                        code,
                        name: product.description || 'Unknown Product',
                        quantity: 1,
                        validationError: validationMessage
                    }]);
                })
                .catch(error => {
                    console.error('Error fetching product:', error);
                    setItems(prevItems => [...prevItems, {
                        code,
                        name: 'Unknown Product',
                        quantity: 1,
                        validationError: validationMessage
                    }]);
                });
        }
    }, []); // Empty dependency array

    // Effect to listen for scan errors to show modal (workaround for useCallback dependency)
    useEffect(() => {
        const handleScanError = (e) => {
            triggerModal('Atención', e.detail, 'warning');
        };
        window.addEventListener('scan-error', handleScanError);
        return () => window.removeEventListener('scan-error', handleScanError);
    }, []);


    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualCode) {
            handleScan(manualCode);
            setManualCode('');
        }
    };

    // Helper to get expected quantity
    const getExpectedQty = (code) => {
        if (!expectedItems) return null;
        const item = expectedItems.find(i => i.barcode === code);
        return item ? item.quantity : 0;
    };

    return (
        <div className="max-w-5xl mx-auto bg-white md:p-8 p-4 rounded-xl shadow-none md:shadow-xl my-0 md:my-8 border-none md:border border-gray-200 relative min-h-screen md:min-h-0">
            <Modal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
            />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 border-b border-gray-100 pb-4 gap-2">
                <h2 className="text-2xl md:text-3xl font-bold text-brand-dark tracking-tight">Nuevo Remito</h2>
                <div className="text-sm text-brand-gray">
                    {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Pre-Remito Section */}
            <div className="mb-8 p-4 md:p-6 bg-brand-bg rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <h3 className="text-lg font-semibold text-brand-dark">Cargar Pedido (Pre-Remito)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-brand-gray mb-2">Número de Pedido</label>
                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                type="text"
                                value={preRemitoNumber}
                                onChange={(e) => setPreRemitoNumber(e.target.value)}
                                className="flex-1 h-12 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition shadow-sm text-base"
                                placeholder="Ej: 123456"
                            />
                            <button
                                onClick={handleLoadPreRemito}
                                className="h-12 w-full md:w-auto bg-brand-blue text-white px-6 rounded-lg hover:bg-blue-800 transition font-medium shadow-sm flex items-center justify-center"
                            >
                                Cargar
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-brand-gray mb-2">O subir PDF de Remito</label>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileUpload}
                            className="block w-full text-sm text-brand-gray
                                file:mr-4 file:py-3 file:px-4
                                file:rounded-lg file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-50 file:text-brand-blue
                                hover:file:bg-blue-100 transition cursor-pointer h-12 pt-1.5"
                        />
                    </div>
                </div>

                {preRemitoStatus === 'found' && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        <span className="font-medium">Pedido cargado con éxito.</span>
                        <span className="ml-2 bg-green-200 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">{expectedItems.length} items esperados</span>
                    </div>
                )}
                {preRemitoStatus === 'not_found' && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        <span className="font-medium">Pedido no encontrado.</span>
                    </div>
                )}
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-8">
                {/* Left Column: Inputs */}
                <div className="lg:col-span-1 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-brand-dark mb-2">Número de Remito (Final)</label>
                        <input
                            type="text"
                            value={remitoNumber}
                            onChange={(e) => setRemitoNumber(e.target.value)}
                            className="w-full h-12 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition shadow-sm text-lg font-medium"
                            placeholder="Ej: 0001-00001234"
                        />
                    </div>

                    <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-semibold mb-4 text-brand-dark">Agregar Productos</h3>

                        {/* Manual Input */}
                        <form onSubmit={handleManualSubmit} className="mb-0">
                            <label className="block text-xs font-medium text-brand-gray mb-1 uppercase tracking-wide">Ingreso Manual</label>
                            <div className="flex flex-col gap-3">
                                <input
                                    type="text"
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value)}
                                    className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition text-base"
                                    placeholder="Código de barras"
                                    autoFocus
                                />
                                <button type="submit" className="h-12 w-full bg-brand-blue text-white border border-transparent rounded-lg hover:bg-blue-800 transition shadow-sm flex items-center justify-center font-medium">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                    Agregar
                                </button>
                            </div>
                        </form>

                        <div className="relative mt-6">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-2 bg-white text-sm text-gray-400">O escanear</span>
                            </div>
                        </div>

                        {/* Camera Scanner Toggle */}
                        <div className="mt-6">
                            <button
                                onClick={() => setIsScanning(!isScanning)}
                                className={`w-full flex items-center justify-center px-4 py-3 rounded-lg border-2 transition font-medium ${isScanning
                                    ? 'border-red-100 text-red-600 hover:bg-red-50'
                                    : 'border-brand-blue text-brand-blue hover:bg-blue-50'
                                    }`}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                {isScanning ? 'Detener Cámara' : 'Usar Cámara'}
                            </button>

                            {isScanning && (
                                <div className="mt-4 rounded-lg overflow-hidden shadow-inner border border-gray-200">
                                    <Scanner onScan={handleScan} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Item List */}
                <div className="lg:col-span-2 flex flex-col h-full">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="font-semibold text-brand-dark flex items-center">
                                <svg className="w-5 h-5 mr-2 text-brand-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                Items Escaneados
                            </h3>
                            <span className="bg-brand-blue text-white text-xs font-bold px-2.5 py-1 rounded-full">{items.length}</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 min-h-[400px]">
                            {items.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                                    <p className="text-lg font-medium">Lista vacía</p>
                                    <p className="text-sm">Escanea productos para comenzar</p>
                                </div>
                            ) : (
                                items.map((item, index) => {
                                    const expectedQty = getExpectedQty(item.code);
                                    const isUnexpected = expectedItems && expectedQty === null;
                                    const isOverQty = expectedItems && expectedQty !== null && item.quantity > expectedQty;
                                    const hasError = isUnexpected || isOverQty;

                                    return (
                                        <div key={index} className={`group flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-lg shadow-sm border transition hover:shadow-md gap-4 ${hasError ? 'border-l-4 border-l-brand-alert border-y-gray-100 border-r-gray-100' : 'border-l-4 border-l-brand-success border-y-gray-100 border-r-gray-100'}`}>
                                            <div className="flex-1 w-full">
                                                <div className="flex items-center justify-between sm:justify-start">
                                                    <p className="font-semibold text-brand-dark text-lg">{item.name}</p>
                                                    {hasError && <span className="ml-2 text-brand-alert"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></span>}
                                                </div>
                                                <p className="text-sm text-brand-gray font-mono tracking-wide">{item.code}</p>
                                                {isUnexpected && <p className="text-xs text-brand-alert font-bold mt-1">⚠️ No solicitado</p>}
                                                {isOverQty && <p className="text-xs text-brand-alert font-bold mt-1">⚠️ Excede cantidad ({expectedQty})</p>}
                                            </div>

                                            <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                                                <div className="flex flex-col items-end">
                                                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                                                        <button
                                                            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-white hover:shadow-sm rounded transition text-lg"
                                                            onClick={() => handleQuantityChange(item.code, Math.max(1, item.quantity - 1))}
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={(e) => handleQuantityChange(item.code, e.target.value)}
                                                            className="w-14 p-0 bg-transparent border-0 text-center font-bold text-brand-dark focus:ring-0 text-lg"
                                                        />
                                                        <button
                                                            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-white hover:shadow-sm rounded transition text-lg"
                                                            onClick={() => handleQuantityChange(item.code, item.quantity + 1)}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    {expectedItems && expectedQty !== null && (
                                                        <span className="text-xs text-brand-gray mt-1 font-medium">de {expectedQty} req.</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveItem(item.code)}
                                                    className="text-gray-400 hover:text-brand-alert p-2 rounded-full hover:bg-red-50 transition"
                                                    title="Eliminar item"
                                                >
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="p-4 bg-white border-t border-gray-200">
                            <button
                                onClick={handleSubmitRemito}
                                disabled={items.length === 0 || !remitoNumber}
                                className={`w-full py-4 rounded-xl font-bold text-lg transition flex items-center justify-center shadow-lg ${items.length > 0 && remitoNumber
                                    ? 'bg-brand-success text-white hover:bg-green-600 hover:shadow-xl transform hover:-translate-y-0.5'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                    }`}
                            >
                                {items.length > 0 && remitoNumber ? (
                                    <>
                                        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        Finalizar Remito
                                    </>
                                ) : (
                                    'Finalizar Remito'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RemitoForm;

