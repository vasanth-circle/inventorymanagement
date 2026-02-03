const StatCard = ({ title, value, icon, color = 'primary', trend }) => {
    const colorClasses = {
        primary: 'bg-primary-50 text-primary-600',
        green: 'bg-green-50 text-green-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        red: 'bg-red-50 text-red-600',
        blue: 'bg-blue-50 text-blue-600',
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {trend && (
                        <p className={`text-sm mt-2 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
                            {trend.value}
                        </p>
                    )}
                </div>
                <div className={`p-4 rounded-full ${colorClasses[color]}`}>
                    <span className="text-3xl">{icon}</span>
                </div>
            </div>
        </div>
    );
};

export default StatCard;
