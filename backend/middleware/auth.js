import jwt from "jsonwebtoken";

// Verify JWT and attach req.user
const authMiddleware = (req, res, next) => {
  // Accept token from Authorization header OR ?token= query param (needed for SSE EventSource)
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token;

  if (!authHeader && !queryToken) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = queryToken || authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Normalise role string — lowercase, strip spaces/dashes/underscores
const normalise = (role) => role?.toLowerCase().replace(/[\s_-]/g, "") ?? "";

// Role guard middleware factory
// Usage: requireRole("superadmin") or requireRole("superadmin", "manager")
export const requireRole = (...allowedRoles) => (req, res, next) => {
  const userRole = normalise(req.user?.role);
  const allowed  = allowedRoles.map(normalise);
  if (!allowed.includes(userRole)) {
    return res.status(403).json({ message: "Access denied: insufficient permissions" });
  }
  next();
};

export const isSuperAdmin    = requireRole("superadmin");
export const isManagerOrAbove = requireRole("superadmin", "manager");

export default authMiddleware;