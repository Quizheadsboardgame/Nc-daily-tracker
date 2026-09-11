import React, { useState } from 'react';
import { X, UserPlus, Trash2, ShieldCheck, Users, Palette, Check } from 'lucide-react';
import { PRESET_VENDOR_PALETTE, cloudDb } from '../db/cloudDatabase';

interface ManageVendorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors?: string[];
  salesmen?: string[];
  onAddVendor?: (name: string, color?: string) => void;
  onAddSalesman?: (name: string, color?: string) => void;
  onRemoveVendor?: (name: string) => void;
  onRemoveSalesman?: (name: string) => void;
  onUpdateVendorColor?: (name: string, color: string) => void;
  getVendorColor?: (name: string) => string;
}

export const ManageVendorsModal: React.FC<ManageVendorsModalProps> = ({
  isOpen,
  onClose,
  vendors: propVendors,
  salesmen: propSalesmen,
  onAddVendor,
  onAddSalesman,
  onRemoveVendor,
  onRemoveSalesman,
  onUpdateVendorColor,
  getVendorColor: propGetVendorColor,
}) => {
  const vendors = propVendors || propSalesmen || [];
  const handleAddVendor = onAddVendor || onAddSalesman || ((name, color) => cloudDb.addVendor(name, color));
  const handleRemoveVendor = onRemoveVendor || onRemoveSalesman || ((name) => cloudDb.removeVendor(name));
  const handleUpdateColor = onUpdateVendorColor || ((name, color) => cloudDb.updateVendorColor(name, color));
  const resolveColor = propGetVendorColor || ((name: string) => cloudDb.getVendorColor(name));

  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorColor, setNewVendorColor] = useState(PRESET_VENDOR_PALETTE[0].hex);
  const [error, setError] = useState('');
  const [vendorToDelete, setVendorToDelete] = useState<string | null>(null);
  const [editingColorVendor, setEditingColorVendor] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newVendorName.trim();
    if (!clean) {
      setError('Vendor name cannot be empty');
      return;
    }
    if (vendors.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setError('This vendor is already in the roster');
      return;
    }

    handleAddVendor(clean, newVendorColor);
    setNewVendorName('');
    // Rotate to next palette color for convenience
    const currentIndex = PRESET_VENDOR_PALETTE.findIndex((p) => p.hex === newVendorColor);
    const nextIndex = (currentIndex + 1) % PRESET_VENDOR_PALETTE.length;
    setNewVendorColor(PRESET_VENDOR_PALETTE[nextIndex].hex);
    setError('');
  };

  const handleConfirmDelete = (name: string) => {
    handleRemoveVendor(name);
    setVendorToDelete(null);
  };

  const handleSelectColorForVendor = (vendor: string, colorHex: string) => {
    handleUpdateColor(vendor, colorHex);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-zinc-900 text-white">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Manage Vendors Roster</h3>
              <p className="text-xs text-zinc-500">Assign brand colors & sync across all devices</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Add Form */}
          <form onSubmit={handleAdd} className="space-y-2.5 p-3.5 bg-zinc-50/80 border border-zinc-200/80 rounded-xl">
            <label htmlFor="input-modal-add-vendor" className="block text-xs font-bold uppercase tracking-wider text-zinc-700">
              Add New Vendor & Choose Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="input-modal-add-vendor"
                value={newVendorName}
                onChange={(e) => {
                  setNewVendorName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Vendor name (e.g. Jessica, Roy, Bradley...)"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
              />

              {/* Color indicator for new vendor */}
              <div className="relative group">
                <label
                  htmlFor="input-new-vendor-color-picker"
                  className="w-9 h-9 rounded-lg border-2 border-white shadow-xs cursor-pointer flex items-center justify-center transition-transform hover:scale-105"
                  style={{ backgroundColor: newVendorColor }}
                  title="Click to pick custom color"
                >
                  <Palette className="w-4 h-4 text-white drop-shadow-xs" />
                </label>
                <input
                  type="color"
                  id="input-new-vendor-color-picker"
                  value={newVendorColor}
                  onChange={(e) => setNewVendorColor(e.target.value)}
                  className="sr-only"
                />
              </div>

              <button
                type="submit"
                id="btn-modal-add-vendor"
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {/* Quick Palette Swatches for new vendor */}
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
              <span className="text-[11px] font-medium text-zinc-500 mr-1 shrink-0">Palette:</span>
              {PRESET_VENDOR_PALETTE.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => setNewVendorColor(p.hex)}
                  className={`w-5 h-5 rounded-full transition-all shrink-0 cursor-pointer flex items-center justify-center ${
                    newVendorColor === p.hex ? 'ring-2 ring-offset-1 ring-zinc-900 scale-110' : 'hover:scale-110 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: p.hex }}
                  title={p.name}
                >
                  {newVendorColor === p.hex && <Check className="w-3 h-3 text-white drop-shadow-xs" />}
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
          </form>

          {/* Current Roster with Color Badges */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Active Vendors ({vendors.length})
              </span>
              <span className="text-[11px] text-zinc-500">Click color dot to change color</span>
            </div>

            <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 bg-white">
              {vendors.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  No vendors registered yet.
                </div>
              ) : (
                vendors.map((vendor) => {
                  const isDeleting = vendorToDelete === vendor;
                  const isEditingColor = editingColorVendor === vendor;
                  const vendorColor = resolveColor(vendor);

                  return (
                    <div key={vendor} className="p-3 transition-colors hover:bg-zinc-50/60">
                      <div className="flex items-center justify-between">
                        {/* Vendor Name & Color Dot */}
                        <div className="flex items-center gap-2.5">
                          {/* Color trigger button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setEditingColorVendor(isEditingColor ? null : vendor)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs transition-transform hover:scale-105 cursor-pointer ring-1 ring-black/10"
                              style={{ backgroundColor: vendorColor }}
                              title={`Change color for ${vendor}`}
                            >
                              {vendor.charAt(0).toUpperCase()}
                            </button>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-zinc-900">{vendor}</span>
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                style={{ backgroundColor: vendorColor }}
                                title={vendorColor}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingColorVendor(isEditingColor ? null : vendor)}
                              className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 underline flex items-center gap-1 cursor-pointer"
                            >
                              <Palette className="w-2.5 h-2.5" />
                              <span>{isEditingColor ? 'Hide colors' : 'Change color'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Actions */}
                        {isDeleting ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-rose-600 mr-1">Remove?</span>
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(vendor)}
                              className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors cursor-pointer"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setVendorToDelete(null)}
                              className="px-2 py-1 text-[11px] font-medium text-zinc-600 bg-zinc-200 hover:bg-zinc-300 rounded-md transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVendorToDelete(vendor)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={`Remove ${vendor}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Expandable Color Palette Picker for this vendor */}
                      {isEditingColor && (
                        <div className="mt-3 pt-3 border-t border-zinc-100 p-2.5 bg-zinc-50 rounded-lg space-y-2 animate-fade-in">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-zinc-700">Assign color to {vendor}:</span>
                            <div className="flex items-center gap-1.5">
                              <label
                                htmlFor={`picker-${vendor}`}
                                className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900 underline cursor-pointer flex items-center gap-1"
                              >
                                Custom hex
                              </label>
                              <input
                                type="color"
                                id={`picker-${vendor}`}
                                value={vendorColor}
                                onChange={(e) => handleSelectColorForVendor(vendor, e.target.value)}
                                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {PRESET_VENDOR_PALETTE.map((p) => {
                              const isSelected = vendorColor.toLowerCase() === p.hex.toLowerCase();
                              return (
                                <button
                                  key={p.hex}
                                  type="button"
                                  onClick={() => handleSelectColorForVendor(vendor, p.hex)}
                                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                                  }`}
                                >
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: p.hex }}
                                  />
                                  <span>{p.name}</span>
                                  {isSelected && <Check className="w-3 h-3 ml-auto text-emerald-400" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Vendor colors immediately sync across all devices via Cloud Firestore and are reflected across cards, charts, and ledger entries.
            </span>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-800 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-lg shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const ManageSalesmenModal = ManageVendorsModal;

