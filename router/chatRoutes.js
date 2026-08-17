import { Router } from "express";
import ChatController from "../controllers/chatController.js";
import { Auth } from "../middleware/authenticate.js";

const router = Router();

// Start chat between client and bidder
router.post(
    "/projects/:projectId/chats",
    Auth,
    ChatController.startChat
);

// Get chats for a project
router.get(
    "/projects/:projectId/chats",
    Auth,
    ChatController.getChatsForProject
);

// Get paginated messages
router.get(
    "/chats/:chatId/messages",
    Auth,
    ChatController.getMessages
);

// Send message
router.post(
    "/chats/:chatId/messages",
    Auth,
    ChatController.sendMessage
);

// Mark message as read
router.patch(
    "/messages/:messageId/read",
    Auth,
    ChatController.markAsRead
);

export default router;