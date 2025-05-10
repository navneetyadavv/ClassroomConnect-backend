import User from "../models/User.js";
import Classroom from "../models/Classroom.js";
import bcrypt from 'bcrypt';

export const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const user = await User.findOne({email});
        if (user) {
            return res.status(409).json({ message: 'User already exists, you can login', success: false });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, role });
        await newUser.save();
        res.status(201).json({ message: "creating user successful", success: true, newUser });
    } catch (err) {
        res.status(500).json({ message: "Internal server error", success: false });
    }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    if (!id) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    if (!updatedData || Object.keys(updatedData).length === 0) {
      return res.status(400).json({ message: "No data provided to update" });
    }
    const updatedUser = await User.findByIdAndUpdate(id, updatedData, {
      new: true,
      runValidators: true,
    });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "User updated successfully", updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === 'Student') {
      const classroom = await Classroom.findById(user.classroom);
      if (classroom) {
        classroom.students = classroom.students.filter(studentId => studentId.toString() !== id);
        
        await classroom.save();
      }
    }
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


export const getStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'Student' })
      .select('name email profilePicture classroom')
      .populate('classroom', 'name')
      .lean(); 
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: 'Teacher' })
      .select('name email profilePicture classroom')
      .populate('classroom', 'name')
      .lean(); 
    res.status(200).json(teachers);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// In your user controller file
export const getAvailableStudents = async (req, res) => {
  try {
    // Get all classrooms to check student assignments
    const classrooms = await Classroom.find().populate('students');
    
    // Get all students who are not in any classroom's students array
    const allStudents = await User.find({ role: 'Student' });
    
    const occupiedStudentIds = classrooms.flatMap(classroom => 
      classroom.students.map(student => student._id.toString())
    );
    
    const availableStudents = allStudents.filter(student => 
      !occupiedStudentIds.includes(student._id.toString())
    );
    
    res.status(200).json(availableStudents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAvailableTeachers = async (req, res) => {
  try {
    // Get all classrooms to check teacher assignments
    const classrooms = await Classroom.find().populate('teacher');
    
    // Get all teachers
    const allTeachers = await User.find({ role: 'Teacher' });
    
    const occupiedTeacherIds = classrooms
      .map(classroom => classroom.teacher?._id?.toString())
      .filter(Boolean);
    
    const availableTeachers = allTeachers.filter(teacher => 
      !occupiedTeacherIds.includes(teacher._id.toString())
    );
    
    res.status(200).json(availableTeachers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};