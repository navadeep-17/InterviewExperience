const Experience = require('../models/Experience');

const validId = id => typeof id === 'string' && id.length === 24 && /^[a-f\d]{24}$/i.test(id);
class ContentInputError extends Error {}
const editableFields = ['company', 'role', 'difficulty', 'roundDate', 'description', 'rounds', 'tips'];

function pickExperienceContent(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ContentInputError();
  const content = {};
  for (const field of editableFields) {
    if (!Object.hasOwn(body, field)) continue;
    const value = body[field];
    if (field === 'rounds') {
      if (!Array.isArray(value)) throw new ContentInputError();
      content.rounds = value.map(round => {
        if (!round || typeof round !== 'object' || Array.isArray(round)) throw new ContentInputError();
        const result = {};
        for (const key of ['roundName', 'questions', 'duration']) {
          if (!Object.hasOwn(round, key)) continue;
          if (typeof round[key] !== 'string') throw new ContentInputError();
          result[key] = round[key];
        }
        return result;
      });
      continue;
    }
    if (typeof value !== 'string') throw new ContentInputError();
    if (['company', 'role'].includes(field)) {
      if (!value.trim()) throw new ContentInputError();
      content[field] = value.trim();
    } else if (field === 'difficulty') {
      if (!['Easy', 'Medium', 'Hard'].includes(value)) throw new ContentInputError();
      content[field] = value;
    } else if (field === 'roundDate') {
      if (!value.trim() || !Number.isFinite(Date.parse(value))) throw new ContentInputError();
      // Reject calendar rollover such as February 30 in ISO date inputs.
      const calendar = value.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/);
      if (calendar && new Date(calendar[1]).toISOString().slice(0, 10) !== calendar[1]) throw new ContentInputError();
      content[field] = value;
    } else content[field] = value;
  }
  if (!Object.keys(content).length || (creating && ['company', 'role', 'difficulty', 'roundDate'].some(key => !Object.hasOwn(content, key)))) {
    throw new ContentInputError();
  }
  return content;
}

function presentExperience(experience) {
  const result = typeof experience.toObject === 'function' ? experience.toObject() : { ...experience };
  delete result.upvotedBy;
  delete result.downvotedBy;
  return result;
}

async function createExperience(req, res) {
  try {
    const content = pickExperienceContent(req.body, true);
    if (typeof req.user.department !== 'string' || !req.user.department.trim()) throw new ContentInputError();
    const experience = new Experience({
      ...content, user: req.user._id, department: req.user.department,
      upvotes: 0, downvotes: 0, upvotedBy: [], downvotedBy: [],
    });
    await experience.save();
    res.status(201).json(presentExperience(experience));
  } catch (error) {
    res.status(error instanceof ContentInputError ? 400 : 500).json({ message: 'Unable to create experience' });
  }
}

const vote = direction => async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid experience ID' });
  try {
    const experience = await Experience.findById(req.params.id);
    if (!experience) return res.status(404).json({ message: 'Experience not found' });
    const userId = req.user._id;
    const up = new Set((experience.upvotedBy || []).map(id => String(id).toLowerCase()));
    const down = new Set((experience.downvotedBy || []).map(id => String(id).toLowerCase()));
    const target = direction === 'up' ? up : down;
    const togglingOff = target.has(userId);
    up.delete(userId);
    down.delete(userId);
    if (!togglingOff) target.add(userId);
    experience.upvotedBy = [...up];
    experience.downvotedBy = [...down];
    experience.upvotes = up.size;
    experience.downvotes = down.size;
    await experience.save();
    res.json({ upvotes: experience.upvotes, downvotes: experience.downvotes });
  } catch (error) {
    res.status(500).json({ message: 'Unable to record vote' });
  }
};

module.exports = {
  createExperience, upvoteExperience: vote('up'), downvoteExperience: vote('down'),
  pickExperienceContent, presentExperience, ContentInputError, validId,
};
