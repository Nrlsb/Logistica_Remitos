import React, { useState } from 'react';
import { toast } from 'sonner';
import api from '../api';

const ClientDiscrepancyModal = ({ isOpen, onClose, remito, onSuccess }) => {
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState('');
    const [type, setType] = useState('missing');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const products = remito.items || [];

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedProduct) {
            toast.error('Por favor selecciona un producto');
            return;
        }
        if (!quantity || Number(quantity) <= 0) {
            toast.error('Por favor ingresa una cantidad válida');
            return;
        }

        setIsSubmitting(true);
        try {
            const product = products.find(p => p.code === selectedProduct);
            await api.patch(`/api/remitos/${remito.id}/client-discrepancy`, {
                product_code: product.code,
                product_description: product.description || product.name,
                quantity: Number(quantity),
                type: type
            });

            toast.success('Discrepancia reportada correctamente');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error reporting discrepancy:', error);
            toast.error('Error al reportar la discrepancia');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-brand-dark">Reportar Discrepancia</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">Remito: {remito.remito_number}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-black text-gray-400 h-1 uppercase tracking-widest mb-3">Producto</label>
                        <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 test-sm font-bold text-gray-700 focus:border-brand-blue focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Seleccionar producto...</option>
                            {products.map((p, idx) => (
                                <option key={idx} value={p.code}>
                                    {p.description || p.name} ({p.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-gray-400 h-1 uppercase tracking-widest mb-4">Cantidad</label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm font-bold text-gray-700 focus:border-brand-blue focus:bg-white outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 h-1 uppercase tracking-widest mb-4">Tipo</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 text-sm font-bold text-gray-700 focus:border-brand-blue focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                            >
                                <option value="missing">Faltante</option>
                                <option value="broken">Rotura</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 px-4 rounded-xl border-2 border-gray-100 text-gray-500 font-black uppercase tracking-widest text-xs hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-3.5 px-4 rounded-xl bg-brand-blue text-white font-black uppercase tracking-widest text-xs hover:bg-brand-dark transition-colors shadow-lg shadow-brand-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Enviando...' : 'Reportar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClientDiscrepancyModal;
