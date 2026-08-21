import helper from "../helper/helper.js";
import ChatService from "../services/chatService.js";

class ChatController {
    /**
     * Start/Get chat between client and professional
     * POST /api/chat/projects/:projectId/chats
     */
    static async startChat(req, res, next) {
        try {
            const { projectId } = req.params;
            const { professionalId, type = "DIRECT", bidId } = req.body;
            const user = req.user;

            let chat;
            if (type === "PROJECT_TEAM") {
                chat = await ChatService.getOrCreateProjectTeamChat(projectId, user.id);
            } else {
                const targetProId = professionalId || (user.role === 1 ? req.body.recipientId : user.id);
                const clientId = user.role === 1 ? user.id : req.body.clientId;

                if (!targetProId || !clientId) {
                    return helper.failed(res, "Missing participant IDs for chat", {}, 400);
                }

                chat = await ChatService.getOrCreateDirectChat(projectId, clientId, targetProId, bidId);
            }

            return helper.success(res, "Chat retrieved/created successfully", chat);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get chats for a project
     * GET /api/chat/projects/:projectId/chats
     */
    static async getChatsForProject(req, res, next) {
        try {
            const { projectId } = req.params;
            const user = req.user || req.admin;
            const chats = await ChatService.getChatsForProject(projectId, user.id, user.role);
            return helper.success(res, "Project chats fetched successfully", chats);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get paginated messages for a chat
     * GET /api/chat/chats/:chatId/messages
     */
    static async getMessages(req, res, next) {
        try {
            const { chatId } = req.params;
            const user = req.user || req.admin;
            const result = await ChatService.getMessages(chatId, user.id, user.role, req.query);
            return helper.success(res, "Chat messages fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.message.includes("Unauthorized") ? 403 : 400);
        }
    }

    /**
     * Send message via REST
     * POST /api/chat/chats/:chatId/messages
     */
    static async sendMessage(req, res, next) {
        try {
            const { chatId } = req.params;
            const { text, attachments } = req.body;
            const user = req.user;

            const message = await ChatService.sendMessage(chatId, user.id, text, attachments);
            return helper.success(res, "Message sent successfully", message);
        } catch (error) {
            return helper.failed(res, error.message, {}, error.message.includes("Unauthorized") ? 403 : 400);
        }
    }

    /**
     * Mark message as read
     * PATCH /api/chat/messages/:messageId/read or PATCH /api/chat/chats/:chatId/read
     */
    static async markAsRead(req, res, next) {
        try {
            const { messageId, chatId } = req.params;
            const user = req.user;

            const targetChatId = chatId || req.body.chatId;
            if (!targetChatId) {
                return helper.failed(res, "Chat ID is required", {}, 400);
            }

            const result = await ChatService.markAsRead(targetChatId, user.id, messageId);
            return helper.success(res, "Messages marked as read", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Get all chats for logged-in user
     * GET /api/chat/me
     */
    static async getMyChats(req, res, next) {
        try {
            const chats = await ChatService.getMyChats(req.user.id);
            return helper.success(res, "My chats fetched successfully", chats);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }
}

export default ChatController;