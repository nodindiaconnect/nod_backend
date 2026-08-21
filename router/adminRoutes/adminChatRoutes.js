import { Router } from "express";
import AdminChatController from "../../controllers/admin/adminChatController.js";
import { Auth, verifyAdmin, checkPermission } from "../../middleware/authenticate.js";

const router = Router();

// Apply Auth and verifyAdmin to all admin chat routes
router.use(Auth, verifyAdmin);

// Get all chats across platform
router.get("/", AdminChatController.getAllChats);

// Get messages for a chat
router.get("/:chatId/messages", AdminChatController.getChatMessages);

// Delete/moderate a message
router.delete("/messages/:messageId", AdminChatController.deleteMessage);

export default router;
