import React, { useState, useEffect } from 'react';
import api from '../api';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import Fuse from 'fuse.js';
import { useAuth } from '../context/AuthContext';

const AchiqueList = () => {
    const { user } = useAuth();
    const [remitos, setRemitos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRemito, setSelectedRemito] = useState(null);
    const [packagesInput, setPackagesInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Confirmation Modal State
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    useEffect(() => {
        fetchRemitos();
    }, []);

    const fetchRemitos = async () => {
        try {
            const response = await api.get('/api/remitos');
            // Show all remitos, user can search/filter. 
            // In a real app we might filter by status, but here default is 'processed'
            setRemitos(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching remitos:', error);
            toast.error('Error al cargar listado');
            setLoading(false);
        }
    };

    const handleOpenModal = (remito) => {
        setSelectedRemito(remito);
        setPackagesInput(remito.total_packages || ''); // Pre-fill if exists
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedRemito(null);
        setPackagesInput('');
    };

    const handleSaveAndPrint = () => {
        const qty = parseInt(packagesInput, 10);
        if (!qty || qty < 1) {
            toast.warning('Ingrese una cantidad válida de bultos');
            return;
        }
        setIsConfirmModalOpen(true);
    };

    const executeSaveAndPrint = async () => {
        const qty = parseInt(packagesInput, 10);

        setIsSaving(true);
        try {
            // 1. Update backend (Packed state)
            const responsePacked = await api.patch(`/api/remitos/${selectedRemito.id}`, {
                total_packages: qty,
                status: 'packed'
            });

            // 2. Generate PDF
            // Ensure we have the user name for the label, fallback to current user if backend doesn't return it immediately
            const updatedRemito = {
                ...selectedRemito,
                ...responsePacked.data,
                packages_added_by: responsePacked.data.packages_added_by || user?.username || 'Usuario'
            };
            generateLabelsPDF(updatedRemito, qty);

            // 3. Update backend (Finalized state) - Assuming print process initiated
            const responseFinalized = await api.patch(`/api/remitos/${selectedRemito.id}`, {
                status: 'finalized'
            });

            // 4. Update local state
            setRemitos(prev => prev.map(r =>
                r.id === selectedRemito.id ? { ...r, ...responseFinalized.data } : r
            ));

            toast.success('Bultos actualizados y etiqueta generada');

            setIsConfirmModalOpen(false);
            handleCloseModal();
        } catch (error) {
            console.error('Error saving packages:', error);
            toast.error('Error al guardar bultos');
        } finally {
            setIsSaving(false);
        }
    };

    const generateLabelsPDF = (remito, quantity) => {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [100, 150] // Custom label size roughly 10x15cm, adjustable
        });

        // If standard A4 is preferred with multiple labels, logic changes.
        // Assuming individual label prints for thermal printers or just one page per label.
        // Or 1 page per label in a single PDF.

        for (let i = 1; i <= quantity; i++) {
            if (i > 1) doc.addPage();

            doc.setFontSize(10);
            doc.text(`${new Date().toLocaleDateString()}`, 75, 10, { align: 'center' });

            doc.setFontSize(40);
            doc.setFont('helvetica', 'bold');
            doc.text(`${i} de ${quantity}`, 75, 40, { align: 'center' }); // Moved up from 50

            doc.setFontSize(16);
            doc.setFont('helvetica', 'normal');
            doc.text(`Pre-remito: ${remito.remito_number}`, 75, 60, { align: 'center' }); // Moved up from 70

            if (remito.numero_pv) {
                doc.text(`PV: ${remito.numero_pv}`, 75, 70, { align: 'center' }); // Moved up from 80
            }
            if (remito.sucursal) {
                doc.text(`Sucursal: ${remito.sucursal}`, 75, 80, { align: 'center' }); // Moved up from 90
            }

            if (remito.packages_added_by) {
                doc.setFontSize(12);
                doc.text(`Achicado por: ${remito.packages_added_by}`, 75, 95, { align: 'center' }); // Moved up from 105 to 95 (fits in 100mm)
            }
        }

        // Save
        doc.save(`Etiquetas_${remito.remito_number}.pdf`);
    };

    // Filter Logic

    const filteredRemitos = React.useMemo(() => {
        let results = remitos;

        if (searchTerm) {
            const fuse = new Fuse(results, {
                keys: ['remito_number', 'numero_pv', 'sucursal'],
                threshold: 0.3,
                ignoreLocation: true
            });
            results = fuse.search(searchTerm).map(result => result.item);
        }

        return results;
    }, [remitos, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-brand-dark">Achique y Etiquetado</h2>
                    <p className="text-gray-500">Gestión de bultos y generación de etiquetas</p>
                </div>
                <div className="w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Buscar por N° pedido o PV..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Pre-remito / Remito</th>
                                <th className="px-6 py-4">PV / Sucursal</th>
                                <th className="px-6 py-4 text-center">Items</th>
                                <th className="px-6 py-4 text-center">Bultos</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">Cargando...</td></tr>
                            ) : filteredRemitos.length === 0 ? (
                                <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">No se encontraron pedidos.</td></tr>
                            ) : (
                                filteredRemitos.map((remito) => (
                                    <tr key={remito.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {new Date(remito.created_at).toLocaleDateString()}
                                            <div className="text-xs text-gray-400">
                                                {new Date(remito.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-medium text-brand-blue bg-blue-50 px-2 py-1 rounded">
                                                {remito.remito_number}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900">{remito.numero_pv || '-'}</span>
                                                <span className="text-xs text-gray-500">Suc: {remito.sucursal || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {remito.items?.length || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {remito.total_packages ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        {remito.total_packages} bultos
                                                    </span>
                                                    {remito.packages_added_by && (
                                                        <span className="text-[10px] text-gray-400 mt-1">
                                                            Por: {remito.packages_added_by}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-sm italic">Pendiente</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleOpenModal(remito)}
                                                className="text-brand-blue hover:text-blue-800 font-medium text-sm bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                                            >
                                                {remito.total_packages ? 'Re-imprimir' : 'Cargar Bultos'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">¿Confirmar Acción?</h3>
                            <p className="text-sm text-gray-600 mb-6">
                                ¿Desea imprimir y enviar los datos del pre-remito a Protheus?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsConfirmModalOpen(false)}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={executeSaveAndPrint}
                                    className="flex-1 px-4 py-2 bg-brand-blue text-white hover:bg-blue-700 rounded-lg font-bold shadow-md hover:shadow-lg transition"
                                >
                                    Sí, Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal */}
            {isModalOpen && selectedRemito && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Cantidad de Bultos</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Ingresa la cantidad total de bultos para el pre-remito <span className="font-mono font-medium">{selectedRemito.remito_number}</span>.
                            </p>

                            <div className="mb-6">
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Total Bultos</label>
                                <input
                                    type="number"
                                    min="1"
                                    autoFocus
                                    className="w-full text-3xl font-bold text-center border-2 border-brand-blue/30 rounded-lg p-3 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition"
                                    value={packagesInput}
                                    onChange={(e) => setPackagesInput(e.target.value)}
                                    placeholder="0"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveAndPrint}
                                    disabled={!packagesInput || parseInt(packagesInput) < 1 || isSaving}
                                    className="flex-1 px-4 py-2 bg-brand-blue text-white hover:bg-blue-700 rounded-lg font-bold shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                                >
                                    {isSaving ? (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        'Confirmar e Imprimir'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AchiqueList;
