import React, { useState, useEffect } from 'react';
import api from '../api';
import ClientDiscrepancyModal from './ClientDiscrepancyModal';

const DiscrepancyList = () => {
    const [remitos, setRemitos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchRemitos();
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // 'all', 'missing', 'extra', 'broken'

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRemito, setSelectedRemito] = useState(null);

    const handleOpenModal = (remito) => {
        setSelectedRemito(remito);
        setIsModalOpen(true);
    };

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
        const missing = (remito.discrepancies?.missing || []).map(item => ({ ...item, type: 'missing', source: 'system' }));
        const extra = (remito.discrepancies?.extra || []).map(item => ({ ...item, type: 'extra', source: 'system' }));
        const client_reported = (remito.discrepancies?.client_reported || []).map(item => ({ ...item, source: 'client' }));
        return [...missing, ...extra, ...client_reported];
    };

    const filteredRemitos = remitos.reduce((acc, remito) => {
        const allItems = getCombinedDiscrepancies(remito);
        const filteredItems = allItems.filter(item => {
            const term = searchTerm.toLowerCase();
            const matchesSearch =
                (item.description?.toLowerCase() || '').includes(term) ||
                (item.code || '').includes(term) ||
                (remito.remito_number?.toString() || '').includes(term);

            const matchesFilter =
                filterType === 'all' ||
                item.type === filterType;

            return matchesSearch && matchesFilter;
        });

        if (filteredItems.length > 0) {
            acc.push({ ...remito, filteredItems });
        }
        return acc;
    }, []);

    if (loading) return <div className="text-center mt-8">Cargando discrepancias...</div>;
    if (error) return <div className="text-center mt-8 text-red-500">{error}</div>;

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h2 className="text-3xl font-black text-brand-dark tracking-tight">Registro de Discrepancias</h2>
                <p className="text-gray-500 font-medium mt-1">Control detallado de faltantes y sobrantes detectados en el escaneo.</p>
            </div>

            {/* Search and Filter Controls */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                    <label htmlFor="search" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Buscar</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-blue">
                            <svg className="h-5 w-5 text-gray-300 group-focus-within:text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            id="search"
                            className="bg-gray-50/50 border-2 border-gray-100 focus:border-brand-blue focus:bg-white focus:ring-4 focus:ring-brand-blue/5 block w-full pl-12 text-sm text-gray-900 rounded-xl p-3.5 transition-all outline-none"
                            placeholder="Remito, código o descripción de producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="w-full md:w-72">
                    <label htmlFor="filter" className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Filtrar por tipo</label>
                    <div className="relative">
                        <select
                            id="filter"
                            className="appearance-none bg-gray-50/50 border-2 border-gray-100 focus:border-brand-blue focus:bg-white focus:ring-4 focus:ring-brand-blue/5 block w-full pl-4 pr-10 py-3.5 text-sm font-bold text-gray-700 rounded-xl transition-all outline-none cursor-pointer"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="all">Todos los registros</option>
                            <option value="missing">Solo Faltantes</option>
                            <option value="extra">Solo Sobrantes</option>
                            <option value="broken">Solo Roturas</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {filteredRemitos.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-black text-gray-700">No hay resultados</h3>
                    <p className="text-gray-400 font-medium mt-1">No se encontraron remitos con discrepancias que coincidan con tu búsqueda.</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {filteredRemitos.map((remito) => {
                        const items = remito.filteredItems;
                        return (
                            <div key={remito.id} className="relative group">
                                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-brand-blue/20 rounded-full group-hover:bg-brand-blue transition-colors"></div>

                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Orden de Carga
                                        </div>
                                        <h3 className="text-2xl font-black text-brand-dark tracking-tight">{remito.remito_number}</h3>
                                        <div className="flex items-center gap-4 mt-1">
                                            <div className="text-sm font-bold text-gray-400 flex items-center gap-1.5">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                {new Date(remito.date).toLocaleDateString()}
                                            </div>
                                            <div className="h-1 w-1 rounded-full bg-gray-300"></div>
                                            <div className="text-sm font-bold text-gray-500 flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded-full bg-brand-blue/10 flex items-center justify-center text-[10px] text-brand-blue border border-brand-blue/20">
                                                    {(remito.created_by || 'U')[0].toUpperCase()}
                                                </div>
                                                {remito.created_by || 'Desconocido'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleOpenModal(remito)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue text-white font-bold text-sm rounded-xl shadow-sm hover:bg-brand-dark transition-colors active:scale-95"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                        </svg>
                                        Reportar Discrepancia
                                    </button>
                                </div>

                                {/* Items Container */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {items.map((item, idx) => {
                                        const isMissing = item.type === 'missing';
                                        const isExtra = item.type === 'extra';
                                        const isBroken = item.type === 'broken';

                                        const accentColor = isMissing ? 'red' : isBroken ? 'yellow' : 'orange';
                                        const label = isMissing ? 'Faltante' : isBroken ? 'Rotura' : 'Sobrante';

                                        const difference = isMissing
                                            ? (item.source === 'system' ? (item.scanned - item.expected) : -item.quantity)
                                            : item.quantity;

                                        const isClientReported = item.source === 'client';

                                        return (
                                            <div key={idx} className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-xl hover:shadow-${accentColor}-900/5 transition-all duration-300 flex flex-col h-full ${isClientReported ? 'ring-2 ring-brand-blue/10 ring-offset-2' : ''}`}>
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className={`${isClientReported ? 'text-brand-blue bg-brand-blue/5' : `text-${accentColor}-600 bg-${accentColor}-50`} text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded border ${isClientReported ? 'border-brand-blue/10' : `border-${accentColor}-100`} w-fit`}>
                                                            {isClientReported ? 'Cliente' : 'Sistema'}
                                                        </span>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-${accentColor}-100 bg-${accentColor}-50 text-${accentColor}-600 w-fit`}>
                                                            {label}
                                                        </span>
                                                    </div>
                                                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-${accentColor}-600 text-white shadow-lg shadow-${accentColor}-600/20`}>
                                                        <span className="text-lg font-black leading-none">{difference > 0 ? `+${difference}` : difference}</span>
                                                    </div>
                                                </div>

                                                <div className="flex-1">
                                                    <h4 className="font-black text-gray-900 leading-tight mb-1 text-base group-hover:text-brand-blue transition-colors">
                                                        {item.description || 'Producto desconocido'}
                                                    </h4>
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-50 text-[10px] font-mono font-bold text-gray-400 border border-gray-100">
                                                        {item.code}
                                                    </div>
                                                </div>

                                                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                                                    <div className="flex gap-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">Esperado</span>
                                                            <span className="font-bold text-sm text-gray-600 font-mono">{isMissing && item.source === 'system' ? item.expected : '-'}</span>
                                                        </div>
                                                        <div className="w-px h-6 bg-gray-100 self-end mb-1"></div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">Actual</span>
                                                            <span className={`font-black text-sm font-mono ${isMissing ? 'text-red-600' : isBroken ? 'text-yellow-600' : 'text-orange-600'}`}>{isMissing && item.source === 'system' ? item.scanned : item.quantity}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-1">
                                                        <button className="p-2 rounded-lg text-gray-300 hover:text-green-500 hover:bg-green-50 transition-all active:scale-95" title="Marcar como revisado">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                                                        </button>
                                                        <button className="p-2 rounded-lg text-gray-300 hover:text-brand-blue hover:bg-brand-blue/5 transition-all active:scale-95" title="Añadir comentario">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedRemito && (
                <ClientDiscrepancyModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    remito={selectedRemito}
                    onSuccess={fetchRemitos}
                />
            )}
        </div>
    );
};

export default DiscrepancyList;
