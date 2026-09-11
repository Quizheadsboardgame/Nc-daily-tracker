import React, { useState } from 'react';
import { Users, UserPlus, Trash2, ShieldCheck, Palette, Check, RefreshCw } from 'lucide-react';
import { PRESET_VENDOR_PALETTE, cloudDb } from '../db/cloudDatabase';

interface ManageVendorsTabProps {
  vendors: string[];
  onAddVendor: (name: string, color?: string) => void;
  onRemoveVendor: (name: string) => void;
  onUpdateVendorColor?: (name: string, color: string) => void;
}

export const ManageVendorsTab: React.FC<ManageVendorsTabProps> = ({
  vendors,
  onAddVendor,
  onRemoveVendor,
  onUpdateVendorColor,
}) => {
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorColor, setNewVendorColor] = useState(PRESET_VENDOR_PALETTE[0].hex);
  const [error, setError] = useState('');
  const [vendorToDelete, setVendorToDelete] = useState<string | null>(null);
  const [selectedVendorForColor, setSelectedVendorForColor] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newVendorName.trim();
    if (!clean) {
      setError('Vendor name cannot be empty');
      return;
    }
    if (vendors.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setError('This vendor is already registered in the roster');
      return;
    }

    onAddVendor(clean, newVendorColor);
    setNewVendorName('');
    // Rotate to next palette color
    const currentIndex = PRESET_VENDOR_PALETTE.findIndex((p) => p.hex === newVendorColor);
    const nextIndex = (currentIndex + 1) % PRESET_VENDOR_PALETTE.length;
    setNewVendorColor(PRESET_VENDOR_PALETTE[nextIndex].hex);
    setError('');
  };

  const handleUpdateColor = (vendor: string, hex: string) => {
    if (onUpdateVendorColor) {
      onUpdateVendorColor(vendor, hex);
    } else {
      cloudDb.updateVendorColor(vendor, hex);
    }
  };

  return (
    <div className="space-y-6" id="manage-vendors-tab-view">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-zinc-900 text-white shadow-xs">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Manage Vendor Team & Brand Colors</h2>
            <p className="text-xs text-zinc-500">
              Assign distinct colors to each vendor. Colors sync automatically across all shared devices.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-800 self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Live Firestore Cloud Sync</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Add New Vendor Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-5 space-y-4">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <span>Add New Vendor</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Enter the vendor&apos;s name and pick their unique signature color.
            </p>
          </div>

          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label htmlFor="input-tab-add-vendor-name" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                Vendor Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="input-tab-add-vendor-name"
                value={newVendorName}
                onChange={(e) => {
                  setNewVendorName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Liam, Jessica, Bradley, Sarah..."
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
              />
              {error && <p className="text-xs text-rose-600 font-medium mt-1">{error}</p>}
            </div>

            {/* Color Picker for new vendor */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                Assign Signature Color
              </label>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ring-2 ring-zinc-900/10"
                  style={{ backgroundColor: newVendorColor }}
                >
                  <Palette className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-zinc-800 uppercase">
                    {newVendorColor}
                  </span>
                  <label
                    htmlFor="input-tab-new-vendor-custom-hex"
                    className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900 underline cursor-pointer"
                  >
                    Custom picker
                  </label>
                  <input
                    type="color"
                    id="input-tab-new-vendor-custom-hex"
                    value={newVendorColor}
                    onChange={(e) => setNewVendorColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
              </div>

              {/* Swatch Grid */}
              <div className="grid grid-cols-6 gap-2">
                {PRESET_VENDOR_PALETTE.map((p) => {
                  const isSelected = newVendorColor.toLowerCase() === p.hex.toLowerCase();
                  return (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setNewVendorColor(p.hex)}
                      className={`h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isSelected ? 'ring-2 ring-offset-2 ring-zinc-900 scale-105 shadow-xs' : 'hover:scale-105 opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: p.hex }}
                      title={p.name}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white drop-shadow-xs" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              id="btn-tab-add-vendor-submit"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Save Vendor to Roster</span>
            </button>
          </form>
        </div>

        {/* Right Column: Active Vendors List & Color Management */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200/90 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Active Vendors Roster ({vendors.length})
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Click any vendor&apos;s color dot or palette button to reassign their color anytime.
              </p>
            </div>
            <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-lg">
              {vendors.length} active
            </span>
          </div>

          <div className="divide-y divide-zinc-100">
            {vendors.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <Users className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm font-semibold">No vendors in roster yet</p>
                <p className="text-xs text-zinc-400 mt-0.5">Use the form on the left to add your first vendor.</p>
              </div>
            ) : (
              vendors.map((vendor) => {
                const vendorColor = cloudDb.getVendorColor(vendor);
                const isEditingColor = selectedVendorForColor === vendor;
                const isDeleting = vendorToDelete === vendor;

                return (
                  <div key={vendor} className="py-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      {/* Vendor Badge & Info */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-xs ring-1 ring-black/10 transition-transform hover:scale-105 cursor-pointer"
                          style={{ backgroundColor: vendorColor }}
                          onClick={() => setSelectedVendorForColor(isEditingColor ? null : vendor)}
                          title="Click to change color"
                        >
                          {vendor.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-zinc-900">{vendor}</h4>
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: vendorColor }}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="font-mono text-[11px]">{vendorColor}</span>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => setSelectedVendorForColor(isEditingColor ? null : vendor)}
                              className="font-medium text-emerald-700 hover:text-emerald-800 underline flex items-center gap-1 cursor-pointer"
                            >
                              <Palette className="w-3 h-3" />
                              <span>{isEditingColor ? 'Done' : 'Change Color'}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Delete Action */}
                      <div>
                        {isDeleting ? (
                          <div className="flex items-center gap-1.5 bg-rose-50 p-1 rounded-lg border border-rose-200">
                            <span className="text-[11px] font-bold text-rose-700 px-1">Remove?</span>
                            <button
                              type="button"
                              onClick={() => {
                                onRemoveVendor(vendor);
                                setVendorToDelete(null);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setVendorToDelete(null)}
                              className="px-2 py-1 text-[11px] font-medium text-zinc-700 bg-white hover:bg-zinc-100 rounded-md border border-zinc-200 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVendorToDelete(vendor)}
                            className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title={`Remove ${vendor} from roster`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Palette for Changing Color */}
                    {isEditingColor && (
                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-zinc-700">Select new color for {vendor}:</span>
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={`tab-picker-${vendor}`}
                              className="text-[11px] font-semibold text-zinc-600 underline cursor-pointer"
                            >
                              Custom color
                            </label>
                            <input
                              type="color"
                              id={`tab-picker-${vendor}`}
                              value={vendorColor}
                              onChange={(e) => handleUpdateColor(vendor, e.target.value)}
                              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {PRESET_VENDOR_PALETTE.map((p) => {
                            const isCurrent = vendorColor.toLowerCase() === p.hex.toLowerCase();
                            return (
                              <button
                                key={p.hex}
                                type="button"
                                onClick={() => handleUpdateColor(vendor, p.hex)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                  isCurrent
                                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                                }`}
                              >
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: p.hex }}
                                />
                                <span>{p.name}</span>
                                {isCurrent && <Check className="w-3 h-3 ml-auto text-emerald-400" />}
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
      </div>
    </div>
  );
};
