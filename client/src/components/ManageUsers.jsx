import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import api from '../api';

const ManageUsers = () => {
    // No need to get token here, api interceptor handles it
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('list'); // 'list' or 'create'

    // Form state for new user
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        user_code: '',
        role: 'user'
    });

    const availableTasks = ['Preparador', 'Controlador', 'Paletizado'];

    useEffect(() => {
        if (activeTab === 'list') {
            fetchUsers();
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Use api instance instead of fetch
            const response = await api.get('/api/users');
            setUsers(response.data);
        } catch (error) {
            console.error('Error:', error);
            toast.error(error.response?.data?.message || 'Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (user) => {
        setEditingUser(user);
        setSelectedTasks(user.tasks || []);
        setIsModalOpen(true);
    };

    const handleTaskChange = (task) => {
        if (selectedTasks.includes(task)) {
            setSelectedTasks(selectedTasks.filter(t => t !== task));
        } else {
            setSelectedTasks([...selectedTasks, task]);
        }
    };

    const handleSave = async () => {
        try {
            // Use api instance for PATCH request
            await api.patch(`/api/users/${editingUser.id}/tasks`, {
                tasks: selectedTasks
            });

            toast.success('Tareas actualizadas correctamente');
            setIsModalOpen(false);
            fetchUsers();
        } catch (error) {
            console.error('Error:', error);
            toast.error(error.response?.data?.message || 'Error al guardar cambios');
        }
    };

    const handleCreateUserChange = (e) => {
        const { name, value } = e.target;

        // Validation for user_code specifically to limit to 3 digits
        if (name === 'user_code') {
            if (value.length > 3) return; // Limit to 3 chars
            // Ensure only numbers
            if (value && !/^\d+$/.test(value)) return;
        }

        setNewUser(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateUserSubmit = async (e) => {
        e.preventDefault();

        // Validate 3 digits
        if (newUser.user_code.length !== 3) {
            toast.error('El código de usuario debe tener exactamente 3 dígitos');
            return;
        }

        try {
            await api.post('/api/admin/users', newUser);
            toast.success('Usuario creado exitosamente');
            // Reset form and go back to list
            setNewUser({ username: '', password: '', user_code: '', role: 'user' });
            setActiveTab('list');
        } catch (error) {
            console.error('Error creating user:', error);
            toast.error(error.response?.data?.message || 'Error al crear usuario');
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Gestión de Usuarios</h1>

            {/* Tabs */}
            {currentUser?.role === 'admin' && (
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'list'
                            ? 'text-indigo-600 border-b-2 border-indigo-600'
                            : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('list')}
                    >
                        Lista de Usuarios
                    </button>
                    <button
                        className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'create'
                            ? 'text-indigo-600 border-b-2 border-indigo-600'
                            : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('create')}
                    >
                        Crear Nuevo Usuario
                    </button>
                </div>
            )}

            {activeTab === 'list' ? (
                loading ? (
                    <div className="text-center mt-10">Cargando usuarios...</div>
                ) : (
                    <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tareas Asignadas</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.tasks && user.tasks.length > 0 ? (
                                                <div className="flex gap-1 flex-wrap">
                                                    {user.tasks.map(task => (
                                                        <span key={task} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                            {task}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic">Sin tareas</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleEditClick(user)}
                                                className="text-indigo-600 hover:text-indigo-900"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                /* Create User Form */
                <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Registrar Nuevo Usuario</h2>
                    <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
                            <input
                                type="text"
                                name="username"
                                value={newUser.username}
                                onChange={handleCreateUserChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                            <input
                                type="text"
                                name="password"
                                value={newUser.password}
                                onChange={handleCreateUserChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Código de Usuario (3 dígitos)
                            </label>
                            <input
                                type="text"
                                name="user_code"
                                value={newUser.user_code}
                                onChange={handleCreateUserChange}
                                required
                                placeholder="Ej: 001"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                            <select
                                name="role"
                                value={newUser.role}
                                onChange={handleCreateUserChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="user">Usuario (Operario)</option>
                                <option value="admin">Administrador</option>
                                <option value="supervisor">Supervisor</option>
                            </select>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                Crear Usuario
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full flex justify-center items-center z-50">
                    <div className="bg-white p-5 rounded-lg shadow-xl w-96 transform transition-all">
                        <h2 className="text-xl font-bold mb-4">Asignar Tareas a {editingUser?.username}</h2>

                        <div className="space-y-3 mb-6">
                            {availableTasks.map(task => (
                                <label key={task} className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedTasks.includes(task)}
                                        onChange={() => handleTaskChange(task)}
                                        className="form-checkbox h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 transition duration-150 ease-in-out"
                                    />
                                    <span className="text-gray-700">{task}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageUsers;
