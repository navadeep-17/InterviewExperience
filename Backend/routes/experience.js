const express = require('express');
const router = express.Router();
const { upvoteExperience, downvoteExperience } = require('../controllers/experienceController');
const auth = require('../middleware/auth');

router.post('/:id/upvote', auth, upvoteExperience);
router.post('/:id/downvote', auth, downvoteExperience);

module.exports = router;