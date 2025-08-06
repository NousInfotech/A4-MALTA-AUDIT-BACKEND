// controllers/procedureController.js
const Procedure = require('../models/Procedure');

exports.seedProcedures = async (req, res, next) => {
  try {
    const { engagementId, title, tasks } = req.body;
    // tasks = [{ description, category }, …]
    const proc = await Procedure.create({
      engagement: engagementId,
      title,
      tasks
    });
    return res.status(201).json(proc);
  } catch (err) {
    next(err);
  }
};

exports.getProceduresByEngagement = async (req, res, next) => {
  try {
    const procs = await Procedure.find({
      engagement: req.params.engagementId
    });
    return res.json(procs);
  } catch (err) {
    next(err);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const { procedureId, taskId } = req.params;
    const { completed } = req.body;

    const proc = await Procedure.findById(procedureId);
    if (!proc) return res.status(404).json({ message: 'Procedure not found' });

    const task = proc.tasks.id(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    task.completed = completed;
    await proc.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`engagement_${proc.engagement}`).emit('procedure:update', proc);

    return res.json(proc);
  } catch (err) {
    next(err);
  }
};
