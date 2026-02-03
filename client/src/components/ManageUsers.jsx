import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const ManageUsers = () => {
    const { token } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const availableTasks = ['Preparador', 'Controlador', 'Paletizado'];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
                headers: {
                    'x-auth-token': token
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error fetching users');
            }

            const data = await response.json();
            setUsers(data);
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al cargar usuarios');
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
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${editingUser.id}/tasks`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': token
                },
                body: JSON.stringify({ tasks: selectedTasks })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error updating tasks');
            }

            toast.success('Tareas actualizadas correctamente');
            setIsModalOpen(false);
            fetchUsers();
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al guardar cambios');
        }
    };

    if (loading) return <div className="text-center mt-10">Cargando usuarios...</div>;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Gestión de Usuarios</h1>

            <div className="bg-white shadow-md rounded-lg overflow-hidden">
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

            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
                    <div className="bg-white p-5 rounded-lg shadow-xl w-96">
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
