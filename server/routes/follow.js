import express from 'express';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// ─── Send follow request ───
router.post('/:userId', protect, async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    // Check if already following or pending
    const existing = await Follow.findOne({
      follower: req.user._id,
      following: targetId
    });
    if (existing) return res.status(400).json({ message: `Already ${existing.status}` });

    // If target's visibility is 'public', auto-accept
    const status = target.visibility === 'public' ? 'accepted' : 'pending';

    const follow = await Follow.create({
      follower: req.user._id,
      following: targetId,
      status
    });

    res.status(201).json({ message: status === 'accepted' ? 'Now following' : 'Follow request sent', follow: { ...follow.toObject(), status } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Accept follow request ───
router.post('/accept/:userId', protect, async (req, res) => {
  try {
    const follow = await Follow.findOne({
      follower: req.params.userId,
      following: req.user._id,
      status: 'pending'
    });
    if (!follow) return res.status(404).json({ message: 'No pending request found' });

    follow.status = 'accepted';
    await follow.save();

    res.json({ message: 'Follow request accepted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Reject / Unfollow ───
router.delete('/:userId', protect, async (req, res) => {
  try {
    // Remove if current user is follower (unfollow) or followee (reject)
    const result = await Follow.deleteOne({
      $or: [
        { follower: req.user._id, following: req.params.userId },
        { follower: req.params.userId, following: req.user._id }
      ]
    });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Follow relationship not found' });
    res.json({ message: 'Done' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Get my followers ───
router.get('/followers', protect, async (req, res) => {
  try {
    const follows = await Follow.find({ following: req.user._id, status: 'accepted' })
      .populate('follower', 'username displayName avatar bio');
    res.json(follows.map(f => f.follower));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Get who I'm following ───
router.get('/following', protect, async (req, res) => {
  try {
    const follows = await Follow.find({ follower: req.user._id, status: 'accepted' })
      .populate('following', 'username displayName avatar bio');
    res.json(follows.map(f => f.following));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Get pending follow requests (for me to approve) ───
router.get('/requests', protect, async (req, res) => {
  try {
    const follows = await Follow.find({ following: req.user._id, status: 'pending' })
      .populate('follower', 'username displayName avatar bio');
    res.json(follows.map(f => ({
      _id: f._id,
      user: f.follower,
      createdAt: f.createdAt
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;