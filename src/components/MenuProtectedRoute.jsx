import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';

const MenuProtectedRoute = ({ children, menuId }) => {
    const { user, hasMenuAccess } = useContext(AuthContext);

    // Check if user has access to this menu
    if (!hasMenuAccess(menuId)) {
        toast.error("You don't have access to this page");
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default MenuProtectedRoute;
