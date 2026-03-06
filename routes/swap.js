const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    owner: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Item = mongoose.model("Item", itemSchema);

const swapSchema = new mongoose.Schema({
    requesterName: { type: String, required: true },
    requesterItem: { type: String, required: true },
    requestedItemId: { type: String, required: true },
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now }
});
const Swap = mongoose.model("Swap", swapSchema);

// Add item
router.post("/addItem", async (req, res) => {
    try {
        const newItem = new Item({
            title: req.body.title,
            description: req.body.description,
            category: req.body.category,
            owner: req.body.owner
        });
        const savedItem = await newItem.save();
        res.json({ message: "Item added successfully", item: savedItem });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all items
router.get("/items", async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single item
router.get("/item/:id", async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).json({ message: "Item not found" });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update item
router.put("/updateItem/:id", async (req, res) => {
    try {
        const updatedItem = await Item.findByIdAndUpdate(
            req.params.id,
            { title: req.body.title, description: req.body.description, category: req.body.category },
            { new: true }
        );
        res.json({ message: "Item updated successfully", item: updatedItem });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete item
router.delete("/deleteItem/:id", async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        res.json({ message: "Item deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create swap request
router.post("/swapRequest", async (req, res) => {
    try {
        const newSwap = new Swap({
            requesterName: req.body.requesterName,
            requesterItem: req.body.requesterItem,
            requestedItemId: req.body.requestedItemId
        });
        const savedSwap = await newSwap.save();
        res.json({ message: "Swap request created", swap: savedSwap });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all swap requests
router.get("/swapRequests", async (req, res) => {
    try {
        const swaps = await Swap.find();
        res.json(swaps);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update swap status
router.put("/swapStatus/:id", async (req, res) => {
    try {
        const swap = await Swap.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );
        res.json({ message: "Swap status updated", swap: swap });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = { router, Item, Swap };
