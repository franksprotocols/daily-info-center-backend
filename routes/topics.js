import express from 'express';
import { getAllTopics, addTopic, updateTopic, deleteTopic } from '../database-selector.js';

const router = express.Router();

// Get all topics
router.get('/', async (req, res) => {
  try {
    const topics = await getAllTopics();
    res.json(topics);
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// Add new topic
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Topic name is required' });
    }
    const topic = await addTopic(name.trim());
    res.status(201).json(topic);
  } catch (error) {
    console.error('Error adding topic:', error);
    if (error.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Topic already exists' });
    } else {
      res.status(500).json({ error: 'Failed to add topic' });
    }
  }
});

// Update topic
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Topic name is required' });
    }

    const topic = await updateTopic(parseInt(id), name.trim(), is_active ? 1 : 0);
    res.json(topic);
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({ error: 'Failed to update topic' });
  }
});

// Delete topic
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteTopic(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({ error: 'Failed to delete topic' });
  }
});

export default router;
