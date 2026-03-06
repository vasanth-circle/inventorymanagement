import { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { UserCircleIcon, KeyIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

const Profile = () => {
    const { user, updateProfile } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || '',
                email: user.email || ''
            }));
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.password && formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        const updateData = {
            name: formData.name,
            email: formData.email
        };

        if (formData.password) {
            updateData.password = formData.password;
        }

        const result = await updateProfile(updateData);
        if (result.success) {
            toast.success('Profile updated successfully');
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        } else {
            toast.error(result.message || 'Failed to update profile');
        }
        setLoading(false);
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="md:flex md:items-center md:justify-between mb-8">
                <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                        My Profile
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage your personal information and security settings.
                    </p>
                </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200 flex items-center">
                    <UserCircleIcon className="h-6 w-6 text-gray-500 mr-2" />
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Personal Information</h3>
                </div>

                <form onSubmit={handleSubmit} className="px-4 py-5 sm:p-6 space-y-6">
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                        <div className="sm:col-span-3">
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                Full Name
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserCircleIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input
                                    type="text"
                                    name="name"
                                    id="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                                    placeholder="Jane Doe"
                                    required
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email Address
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <EnvelopeIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    id="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                                    placeholder="jane@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="sm:col-span-3">
                            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                                Role
                            </label>
                            <div className="mt-1">
                                <input
                                    type="text"
                                    id="role"
                                    value={user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1) || ''}
                                    disabled
                                    className="bg-gray-100 cursor-not-allowed block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-gray-200">
                        <div className="flex items-center mb-6">
                            <KeyIcon className="h-6 w-6 text-gray-500 mr-2" />
                            <h3 className="text-lg leading-6 font-medium text-gray-900">Change Password</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Leave empty if you don't want to change your password.</p>

                        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                            <div className="sm:col-span-3">
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    New Password
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="password"
                                        name="password"
                                        id="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                                        placeholder="••••••••"
                                        minLength="6"
                                    />
                                </div>
                            </div>
                            <div className="sm:col-span-3">
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                    Confirm New Password
                                </label>
                                <div className="mt-1">
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        id="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className="focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                                        placeholder="••••••••"
                                        minLength="6"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-5 border-t border-gray-200">
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Profile;
