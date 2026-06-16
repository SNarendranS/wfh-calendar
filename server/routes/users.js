import express from 'express';
import User from '../models/User.js';
import Follow from '../models/Follow.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// ─── Get own profile ───
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -pushSubscriptions');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Update own profile ───
router.put('/profile', protect, async (req, res) => {
  try {
    const { displayName, bio, phone, visibility, avatar } = req.body;
    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (phone !== undefined) updates.phone = phone;
    if (visibility !== undefined) updates.visibility = visibility;
    if (avatar !== undefined) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password -pushSubscriptions');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Get public profile of another user ───
router.get('/:id/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('username displayName avatar bio visibility companyId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check follow relationship
    const follow = await Follow.findOne({
      follower: req.user._id,
      following: user._id
    });

    // Check if bookmarked
    const currentUser = await User.findById(req.user._id).select('bookmarkedUsers');
    const isBookmarked = currentUser?.bookmarkedUsers?.some(
      id => id.toString() === req.params.id
    ) || false;

    // Count followers / following
    const followerCount = await Follow.countDocuments({ following: user._id, status: 'accepted' });
    const followingCount = await Follow.countDocuments({ follower: user._id, status: 'accepted' });

    res.json({
      ...user.toObject(),
      followStatus: follow ? follow.status : null,
      followId: follow?._id,
      isBookmarked,
      followerCount,
      followingCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Bookmark a user (max 3) ───
router.post('/bookmark/:userId', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const targetId = req.params.userId;
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot bookmark yourself' });
    }

    // Check if already bookmarked
    if (currentUser.bookmarkedUsers?.some(id => id.toString() === targetId)) {
      return res.status(400).json({ message: 'Already bookmarked' });
    }

    // Max 3
    if ((currentUser.bookmarkedUsers?.length || 0) >= 3) {
      return res.status(400).json({ message: 'Maximum 3 bookmarks allowed. Remove one first.' });
    }

    currentUser.bookmarkedUsers.push(targetId);
    await currentUser.save();

    res.json({ message: 'Bookmarked', bookmarkedUsers: currentUser.bookmarkedUsers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Remove bookmark ───
router.delete('/bookmark/:userId', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    currentUser.bookmarkedUsers = currentUser.bookmarkedUsers.filter(
      id => id.toString() !== req.params.userId
    );
    await currentUser.save();

    res.json({ message: 'Removed bookmark', bookmarkedUsers: currentUser.bookmarkedUsers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Get bookmarked users with today's entry ───
router.get('/bookmarks', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).populate({
      path: 'bookmarkedUsers',
      select: 'username displayName avatar bio visibility'
    });

    const today = new Date().toISOString().split('T')[0];
    const CalendarEntry = (await import('../models/CalendarEntry.js')).default;

    const bookmarksWithStatus = await Promise.all((currentUser.bookmarkedUsers || []).map(async (u) => {
      const entry = await CalendarEntry.findOne({ userId: u._id, date: today }).select('type leaveType');
      return {
        ...u.toObject(),
        todayEntry: entry || null
      };
    }));

    res.json(bookmarksWithStatus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Search users ───
router.get('/search/:query', protect, async (req, res) => {
  try {
    const query = req.params.query;
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { displayName: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
    .select('username displayName avatar bio visibility')
    .limit(20);

    // Get follow status for each user
    const userIds = users.map(u => u._id);
    const follows = await Follow.find({
      follower: req.user._id,
      following: { $in: userIds }
    });
    const followMap = {};
    follows.forEach(f => { followMap[f.following.toString()] = f.status; });

    const results = users.map(u => ({
      ...u.toObject(),
      followStatus: followMap[u._id.toString()] || null
    }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;