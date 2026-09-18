import { useState, useEffect, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';
import Drawer from '../components/ui/Drawer';
import FormField from '../components/ui/FormField';

const Locations = () => {
    const { locations, assetLocations, addLocation, editLocation, removeLocation, loading, confirmDelete, fetchLocations, fetchAssetLocations } = useContext(InventoryContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState(null);
    
    // Determine the type based on the active application
    const activeApp = sessionStorage.getItem('activeApp') || 'inventory';
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [locationType] = useState(activeApp === 'assets' ? 'asset' : 'inventory');

    useEffect(() => {
        if (locationType === 'asset') {
            fetchAssetLocations();
        } else {
            fetchLocations();
        }
    }, []);

    const handleOpenModal = (location = null) => {
        if (location) {
            setEditingLocation(location);
            setFormData({ name: location.name, description: location.description || '' });
        } else {
            setEditingLocation(null);
            setFormData({ name: '', description: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingLocation(null);
        setFormData({ name: '', description: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const locationData = {
            ...formData,
            type: locationType
        };

        if (editingLocation) {
            const result = await editLocation(editingLocation._id, locationData);
            if (result.success) {
                toast.success('Location updated successfully');
            }
        } else {
            const result = await addLocation(locationData);
            if (result.success) {
                toast.success('Location created successfully');
            }
        }
        
        if (locationType === 'asset') {
            await fetchAssetLocations();
        } else {
            await fetchLocations();
        }
        handleCloseModal();
    };

    const handleDelete = async (id) => {
        const confirmed = await confirmDelete('Are you sure you want to remove this location?');
        if (confirmed) {
            await removeLocation(id);
            toast.success('Location removed successfully');
            if (locationType === 'asset') {
                await fetchAssetLocations();
            } else {
                await fetchLocations();
            }
        }
    };

    const currentLocations = locationType === 'asset' ? assetLocations : locations;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {locationType === 'asset' ? 'Branch & Asset Locations' : 'Inventory Locations'}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Manage your {locationType === 'asset' ? 'office branches and asset storage points' : 'warehouses and stock storage points'}.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md font-semibold"
                >
                    Add {locationType === 'asset' ? 'Asset' : 'Inventory'} Location
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentLocations.length > 0 ? (
                            currentLocations.map((loc) => (
                                <tr key={loc._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loc.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{loc.description || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        <button
                                            onClick={() => handleOpenModal(loc)}
                                            className="text-primary-600 hover:text-primary-900"
                                        >
                                            ✏️ Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(loc._id)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            🗑️ Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="3" className="px-6 py-4 text-center text-gray-500">
                                    No locations found. Add your first location to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Drawer 
                open={isModalOpen} 
                onClose={handleCloseModal}
                title={editingLocation ? 'Edit Location' : 'Add New Location'}
                subtitle={`Manage your ${locationType === 'asset' ? 'office branches and asset storage points' : 'warehouses and stock storage points'}.`}
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="btn-primary"
                        >
                            {editingLocation ? 'Update Location' : 'Save Location'}
                        </button>
                    </div>
                }
            >
                <form id="location-form" onSubmit={handleSubmit} className="p-6 space-y-4">
                    <FormField label="Name" required>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                    </FormField>
                    <FormField label="Description">
                        <textarea
                            rows="3"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        ></textarea>
                    </FormField>
                </form>
            </Drawer>
        </div>
    );
};

export default Locations;
