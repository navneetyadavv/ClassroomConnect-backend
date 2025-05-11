import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Principal from '../models/Principal.js';

// Common error messages and responses
const AUTH_ERROR = { 
    message: 'Auth failed, email or password is wrong', 
    success: false 
};
const SERVER_ERROR = { 
    message: 'Internal server error', 
    success: false 
};

// Common login logic
const handleLogin = async (model, req, res, role = null) => {
    try {
        const { email, password } = req.body;
        
        // Add .select('+password') to include the password field
        const user = await model.findOne({ email }).select('+password');
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(403).json(AUTH_ERROR);
        }

        const payload = {
            email: user.email,
            _id: user._id,
            role: role || user.role
        };

        const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

        return res.status(200).json({
            message: "Login successful",
            success: true,
            jwtToken,
            email,
            name: user.name,
            role: payload.role
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json(SERVER_ERROR);
    }
};

export const principalLogin = (req, res) => handleLogin(Principal, req, res, 'Principal');
export const userLogin = (req, res) => handleLogin(User, req, res);