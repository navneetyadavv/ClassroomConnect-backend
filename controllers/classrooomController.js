import Classroom from "../models/Classroom.js";
import User from "../models/User.js";

// Helper function to handle errors
const handleError = (res, error, defaultMessage = "Server error") => {
  console.error(error);
  return res.status(500).json({ 
    message: defaultMessage, 
    error: error.message 
  });
};

export const createClassroom = async (req, res) => {
  try {
    const { name, schedule, teacher, students } = req.body;
    
    // Validate input
    if (!name) {
      return res.status(400).json({ message: "Classroom name is required" });
    }

    // Create classroom
    const classroom = new Classroom({
      name,
      schedule: schedule || [],
      teacher: teacher || null,
      students: students || [],
    });

    await classroom.save();

    // Update user references in a transaction
    const session = await Classroom.startSession();
    session.startTransaction();

    try {
      if (teacher) {
        await User.findByIdAndUpdate(
          teacher,
          { $set: { classroom: classroom._id } },
          { session }
        );
      }

      if (students && students.length > 0) {
        await User.updateMany(
          { _id: { $in: students }, role: "Student" },
          { $set: { classroom: classroom._id } },
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({
        message: "Classroom created successfully",
        classroom,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    handleError(res, error, "Failed to create classroom");
  }
};

export const deleteClassroom = async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await Classroom.startSession();
    session.startTransaction();

    try {
      // Clear classroom references from users
      await User.updateMany(
        { classroom: id },
        { $set: { classroom: null } },
        { session }
      );

      // Delete the classroom
      await Classroom.findByIdAndDelete(id, { session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: "Classroom deleted successfully" });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    handleError(res, error, "Failed to delete classroom");
  }
};

export const getClassrooms = async (req, res) => {
  try {
    const classrooms = await Classroom.find()
      .populate("teacher")
      .populate("students")
      .populate("timetables")
      .lean();

    res.status(200).json(classrooms);
  } catch (error) {
    handleError(res, error);
  }
};

export const assignTeacherToClassroom = async (req, res) => {
  try {
    const { classroomId, teacherId } = req.body;

    if (!classroomId || !teacherId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const session = await Classroom.startSession();
    session.startTransaction();

    try {
      // Check if teacher is already assigned to another classroom
      const existingAssignment = await Classroom.findOne({ 
        teacher: teacherId 
      }).session(session);

      if (existingAssignment) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          message: "Teacher is already assigned to another classroom" 
        });
      }

      // Get the classroom and teacher
      const classroom = await Classroom.findById(classroomId).session(session);
      const teacher = await User.findById(teacherId).session(session);

      if (!classroom || !teacher) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Classroom or teacher not found" });
      }

      // Remove teacher from previous classroom if any
      if (classroom.teacher) {
        await User.findByIdAndUpdate(
          classroom.teacher,
          { $set: { classroom: null } },
          { session }
        );
      }

      // Assign new teacher
      classroom.teacher = teacherId;
      teacher.classroom = classroomId;

      await classroom.save({ session });
      await teacher.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ 
        message: "Teacher assigned to classroom successfully",
        classroom
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    handleError(res, error, "Failed to assign teacher");
  }
};

export const removeTeacherFromClassroom = async (req, res) => {
  try {
    const { classroomId } = req.body;

    const session = await Classroom.startSession();
    session.startTransaction();

    try {
      const classroom = await Classroom.findById(classroomId).session(session);
      
      if (!classroom) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Classroom not found" });
      }

      if (!classroom.teacher) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "No teacher assigned to this classroom" });
      }

      // Remove teacher reference
      await User.findByIdAndUpdate(
        classroom.teacher,
        { $set: { classroom: null } },
        { session }
      );

      classroom.teacher = null;
      await classroom.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ 
        message: "Teacher removed from classroom successfully",
        classroom
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    handleError(res, error, "Failed to remove teacher");
  }
};

export const assignStudentInClassroom = async (req, res) => {
  try {
    const { classroomId, newStudents } = req.body;

    if (!classroomId || !Array.isArray(newStudents)) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    const session = await Classroom.startSession();
    session.startTransaction();

    try {
      const classroom = await Classroom.findById(classroomId).session(session);
      
      if (!classroom) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Classroom not found" });
      }

      // Get current students as strings for comparison
      const currentStudents = classroom.students.map(id => id.toString());

      // Find students to add and remove
      const studentsToAdd = newStudents.filter(
        studentId => !currentStudents.includes(studentId)
      );
      const studentsToRemove = currentStudents.filter(
        studentId => !newStudents.includes(studentId)
      );

      // Validate all students exist and are actually students
      const existingStudents = await User.find({
        _id: { $in: newStudents },
        role: "Student"
      }).session(session);

      if (existingStudents.length !== newStudents.length) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          message: "One or more students are invalid or not students" 
        });
      }

      // Update classroom students
      classroom.students = newStudents;
      await classroom.save({ session });

      // Update students being added
      if (studentsToAdd.length > 0) {
        await User.updateMany(
          { _id: { $in: studentsToAdd } },
          { $set: { classroom: classroomId } },
          { session }
        );
      }

      // Update students being removed
      if (studentsToRemove.length > 0) {
        await User.updateMany(
          { _id: { $in: studentsToRemove } },
          { $set: { classroom: null } },
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        message: "Classroom students updated successfully",
        classroom
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    handleError(res, error, "Failed to update classroom students");
  }
};