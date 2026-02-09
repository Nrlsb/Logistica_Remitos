import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

const RemitoDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [remito, setRemito] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mainTab, setMainTab] = useState('scanned');

    useEffect(() => {
        const fetchRemito = async () => {
            try {
                const response = await api.get(`/api/remitos/${id}`);
                setRemito(response.data);
            } catch (error) {
                console.error('Error fetching remito details:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchRemito();
    }, [id]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div>
            </div>
        );
    }

    if (!remito) {
        return (
            <div className="text-center py-12">
                <h3 className="text-xl font-bold text-gray-700">No se encontró el remito</h3>
                <button
                    onClick={() => navigate('/list')}
                    className="mt-4 text-brand-blue hover:underline"
                >
                    Volver al listado
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <button
                onClick={() => navigate('/list')}
                className="mb-6 flex items-center text-gray-500 hover:text-brand-blue transition"
            >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver al listado
            </button>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-black text-brand-dark">Detalle del Pedido</h2>
                                <span className="text-sm bg-gray-100 text-gray-500 px-3 py-1 rounded font-mono border border-gray-200">{remito.remito_number}</span>
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
                                <div className="flex items-center gap-1.5 text-sm">
                                    <span className="text-gray-400 font-bold uppercase tracking-tight">Preparó:</span>
                                    <span className="text-gray-900 font-black">{remito.prepared_by || '-'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm">
                                    <span className="text-gray-400 font-bold uppercase tracking-tight">Escaneó:</span>
                                    <span className="text-gray-900 font-black">{remito.created_by || 'Sistema'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm">
                                    <span className="text-gray-400 font-bold uppercase tracking-tight">Achicó:</span>
                                    <span className="text-gray-900 font-black">{remito.packages_added_by || (remito.status === 'finalized' ? '-' : 'Pendiente')}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-gray-500">{new Date(remito.date).toLocaleDateString()}</span>
                            <span className={`mt-2 px-3 py-1 text-xs font-black uppercase rounded-full border ${remito.status === 'finalized' ? 'bg-green-100 text-green-700 border-green-200' :
                                    remito.status === 'packed' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                        'bg-gray-100 text-gray-600 border-gray-200'
                                }`}>
                                {remito.status === 'finalized' ? 'Finalizado' : remito.status === 'packed' ? 'Achicado' : 'Escaneado'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50/50">
                    <button
                        onClick={() => setMainTab('scanned')}
                        className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition ${mainTab === 'scanned'
                            ? 'border-brand-blue text-brand-blue bg-white'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        Productos Escaneados ({remito.items?.length || 0})
                    </button>
                    <button
                        onClick={() => setMainTab('discrepancies')}
                        className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition ${mainTab === 'discrepancies'
                            ? 'border-brand-blue text-brand-blue bg-white'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        Discrepancias
                        {(remito.discrepancies?.missing?.length > 0 || remito.discrepancies?.extra?.length > 0) && (
                            <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs font-bold">
                                !
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {mainTab === 'scanned' && (
                        <div className="space-y-4">
                            {remito.items && remito.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-brand-blue/30 transition">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="font-bold text-gray-900 text-base truncate">{item.name || item.description || 'Producto'}</p>
                                        <p className="text-xs text-brand-blue font-mono mt-1 bg-brand-blue/5 inline-block px-2 py-0.5 rounded">{item.code || item.barcode}</p>
                                    </div>
                                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-brand-blue/10 flex items-center justify-center border border-brand-blue/20">
                                        <span className="text-sm font-black text-brand-blue">x{item.quantity}</span>
                                    </div>
                                </div>
                            ))}
                            {(!remito.items || remito.items.length === 0) && (
                                <div className="text-center py-20 text-gray-400 italic">
                                    <svg className="mx-auto h-12 w-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                                    No hay productos escaneados
                                </div>
                            )}
                        </div>
                    )}

                    {mainTab === 'discrepancies' && (
                        <div>
                            {(remito.discrepancies && (remito.discrepancies.missing?.length > 0 || remito.discrepancies.extra?.length > 0)) ? (
                                <div className="space-y-8">
                                    {remito.clarification && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                                            <h5 className="text-sm font-bold text-yellow-800 mb-2 flex items-center uppercase tracking-wider">
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
                                                Aclaración del Usuario
                                            </h5>
                                            <p className="text-gray-900 italic font-medium leading-relaxed">
                                                "{remito.clarification}"
                                            </p>
                                        </div>
                                    )}

                                    {remito.discrepancies.missing?.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-black text-red-600 uppercase tracking-widest mb-4 flex items-center">
                                                <span className="w-8 h-px bg-red-200 mr-3"></span>
                                                Faltantes ({remito.discrepancies.missing.length})
                                                <span className="flex-1 h-px bg-red-200 ml-3"></span>
                                            </h4>
                                            <ul className="space-y-4">
                                                {remito.discrepancies.missing.map((item, idx) => (
                                                    <li key={idx} className="flex items-center bg-red-50/50 p-4 rounded-xl border border-red-100 shadow-sm">
                                                        <div className="mt-1 mr-4 text-red-500 bg-white p-2 rounded-lg shadow-sm">
                                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                                        </div>
                                                        <div className="flex-1 min-w-0 mr-4">
                                                            <span className="text-gray-900 font-bold text-base block mb-1">{item.description || item.code}</span>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs text-gray-400 font-mono">{item.code}</span>
                                                                {item.reason && (
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${item.reason === 'no_stock' ? 'bg-gray-200 text-gray-700' : 'bg-red-200 text-red-800'}`}>
                                                                        {item.reason === 'no_stock' ? 'Sin Stock' : 'Dañado'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-center justify-center bg-white px-4 py-2 rounded-lg border border-red-100 shadow-sm shrink-0">
                                                            <span className="text-lg font-black text-red-600">-{item.expected - item.scanned}</span>
                                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Esp. {item.expected}</span>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {remito.discrepancies.extra?.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-black text-orange-600 uppercase tracking-widest mb-4 flex items-center">
                                                <span className="w-8 h-px bg-orange-200 mr-3"></span>
                                                Sobrantes ({remito.discrepancies.extra.length})
                                                <span className="flex-1 h-px bg-orange-200 ml-3"></span>
                                            </h4>
                                            <ul className="space-y-4">
                                                {remito.discrepancies.extra.map((item, idx) => (
                                                    <li key={idx} className="flex items-center bg-orange-50/50 p-4 rounded-xl border border-orange-100 shadow-sm">
                                                        <div className="mt-1 mr-4 text-orange-500 bg-white p-2 rounded-lg shadow-sm">
                                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                                        </div>
                                                        <div className="flex-1 min-w-0 mr-4">
                                                            <span className="text-gray-900 font-bold text-base block mb-1">{item.description || item.code}</span>
                                                            <span className="text-xs text-gray-400 font-mono">{item.code}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center justify-center bg-white px-4 py-2 rounded-lg border border-orange-100 shadow-sm shrink-0">
                                                            <span className="text-lg font-black text-orange-600">+{item.quantity}</span>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-900">Todo en orden</h4>
                                    <p className="text-gray-500 mt-2">No se encontraron discrepancias en este remito.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RemitoDetail;
