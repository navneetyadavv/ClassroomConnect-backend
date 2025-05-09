import bcrypt from 'bcrypt';
import Principal from '../models/Principal.js';

// Constants for seed data
const SEED_PRINCIPAL = {
  email: 'principal@classroom.com',
  password: 'Admin' // Note: In production, this should come from environment variables
};

export const seedPrincipal = async () => {
  try {
    // Check if principal already exists
    const existingPrincipal = await Principal.findOne({ email: SEED_PRINCIPAL.email });
    
    if (existingPrincipal) {
      console.log('Principal already exists in database');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(SEED_PRINCIPAL.password, 10);
    
    // Create new principal
    const principal = new Principal({
      email: SEED_PRINCIPAL.email,
      password: hashedPassword,
      // Add any other required fields here
    });

    // Save to database
    await principal.save();
    console.log('Principal successfully seeded');

  } catch (error) {
    console.error('Error seeding principal:', error);
  }
};