import React, { useState, useEffect } from 'react';
import api from '../api';

const DiscrepancyList = () => {
    const [remitos, setRemitos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchRemitos();
    }, []);

    const fetchRemitos = async () => {
        try {
            const response = await api.get('/api/remitos');
            // Filter remitos that have discrepancies
            const discrepancyRemitos = response.data.filter(remito => {
                const hasMissing = remito.discrepancies?.missing?.length > 0;
                const hasExtra = remito.discrepancies?.extra?.length > 0;
                return hasMissing || hasExtra;
            });
            setRemitos(discrepancyRemitos);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching remitos:', err);
            setError('Error al cargar las discrepancias.');
            setLoading(false);
        }
    };

    const getCombinedDiscrepancies = (remito) => {
        const missing = (remito.discrepancies?.missing || []).map(item => ({ ...item, type: 'missing' }));
        const extra = (remito.discrepancies?.extra || []).map(item => ({ ...item, type: 'extra' }));
        return [...missing, ...extra];
    };

    if (loading) return <div className="text-center mt-8">Cargando discrepancias...</div>;
    if (error) return <div className="text-center mt-8 text-red-500">{error}</div>;

    return (
        <div className="container mx-auto p-4">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Registro de Discrepancias</h2>

            {remitos.length === 0 ? (
                <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
                    No se encontraron remitos con discrepancias.
                </div>
            ) : (
                <div className="space-y-8">
                    {remitos.map((remito) => {
                        const items = getCombinedDiscrepancies(remito);
                        return (
                            <div key={remito.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                                <div className="bg-navy-900 p-4 border-b border-gray-200 flex justify-between items-center bg-white">
                                    <div>
                                        <span className="font-semibold text-lg text-gray-700">Remito: {remito.remito_number}</span>
                                        <div className="text-sm text-gray-500">{new Date(remito.date).toLocaleString()}</div>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        Creado por: <span className="font-medium">{remito.created_by || 'Desconocido'}</span>
                                    </div>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-4 px-4 pb-4">
                                    {items.map((item, idx) => {
                                        const isMissing = item.type === 'missing';
                                        const cardBg = isMissing ? 'bg-[#FEF2F2]' : 'bg-[#FFFBEB]';
                                        const textColor = isMissing ? 'text-[#991B1B]' : 'text-[#92400E]';
                                        const badgeBg = isMissing ? 'bg-[#991B1B]' : 'bg-[#92400E]';
                                        const difference = isMissing
                                            ? (item.scanned - item.expected)
                                            : item.quantity;

                                        return (
                                            <div key={idx} className={`${cardBg} rounded-xl p-4 shadow-sm border border-opacity-10 border-gray-400 relative`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="pr-14">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-current ${textColor} bg-white bg-opacity-60`}>
                                                                {isMissing ? 'Faltante' : 'Sobrante'}
                                                            </span>
                                                        </div>
                                                        <h3 className={`font-bold text-lg leading-tight mb-2 ${textColor}`}>
                                                            {item.description || 'Producto desconocido'}
                                                        </h3>
                                                        <div className={`text-xs font-mono opacity-80 ${textColor} mb-3`}>
                                                            {item.code}
                                                        </div>
                                                        <div className={`text-sm ${textColor} flex items-center gap-2 bg-white bg-opacity-40 p-2 rounded-lg inline-block`}>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] uppercase opacity-70">Esperado</span>
                                                                <span className="font-bold font-mono text-base">{isMissing ? item.expected : '-'}</span>
                                                            </div>
                                                            <div className="h-8 w-px bg-current opacity-20 mx-1"></div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] uppercase opacity-70">Encontrado</span>
                                                                <span className="font-bold font-mono text-base">{isMissing ? item.scanned : '-'}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col items-center">
                                                        <div className={`w-14 h-14 rounded-full ${badgeBg} text-white flex items-center justify-center text-xl font-bold shadow-md`}>
                                                            {difference > 0 ? `+${difference}` : difference}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-[#F9FAFB]">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Esperado</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Encontrado</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diferencia</th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {items.map((item, idx) => {
                                                const isMissing = item.type === 'missing';
                                                const rowClass = isMissing ? 'bg-[#FEF2F2]' : 'bg-[#FFFBEB]';
                                                const textClass = isMissing ? 'text-[#991B1B]' : 'text-[#92400E]';
                                                const badgeClass = isMissing
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-yellow-100 text-yellow-800';
                                                const badgeText = isMissing ? 'Faltante' : 'Sobrante';
                                                const difference = isMissing
                                                    ? (item.scanned - item.expected)
                                                    : item.quantity; // For extra, quantity is the surplus amount

                                                return (
                                                    <tr key={idx} className={rowClass}>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                <div className={`text-sm font-medium ${textClass}`}>
                                                                    {item.description || 'Producto desconocido'}
                                                                </div>
                                                                <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}`}>
                                                                    {badgeText}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono ${textClass}`}>
                                                            {item.code}
                                                        </td>
                                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono ${textClass}`}>
                                                            {isMissing ? item.expected : '-'}
                                                        </td>
                                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono ${textClass}`}>
                                                            {isMissing ? item.scanned : '-'}
                                                        </td>
                                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono font-bold ${textClass}`}>
                                                            {difference > 0 ? `+${difference}` : difference}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <div className="flex justify-end space-x-2">
                                                                <button className={`text-opacity-70 hover:text-opacity-100 ${textClass}`} title="Marcar como revisado">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                                                    </svg>
                                                                </button>
                                                                <button className={`text-opacity-70 hover:text-opacity-100 ${textClass}`} title="Añadir comentario">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DiscrepancyList;
