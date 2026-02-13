import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ role, children }) => {
  if (!role) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
