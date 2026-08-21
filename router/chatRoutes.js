import { Router } from "express";
import ChatController from "../controllers/chatController.js";
import { Auth } from "../middleware/authenticate.js";

const router = Router();

// Get all conversations for current user
router.get("/me", Auth, ChatController.getMyChats);

// Start / get chat for a project
router.post("/projects/:projectId/chats", Auth, ChatController.startChat);

// Get all chats for a project
router.get("/projects/:projectId/chats", Auth, ChatController.getChatsForProject);

// Get paginated messages for a chat
router.get("/chats/:chatId/messages", Auth, ChatController.getMessages);

// Send message via REST
router.post("/chats/:chatId/messages", Auth, ChatController.sendMessage);

// Mark message as read
router.patch("/messages/:messageId/read", Auth, ChatController.markAsRead);
router.patch("/chats/:chatId/read", Auth, ChatController.markAsRead);

export default router;