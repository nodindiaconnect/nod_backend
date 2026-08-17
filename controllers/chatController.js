class ChatController {
    // POST /api/projects/:projectId/chats
    static async startChat(req, res, next) {
        try {
            // participants: [clientId, professionalId]
            // linked to bidId
        } catch (error) {
            next(error);
        }
    }

    // GET /api/projects/:projectId/chats
    static async getChatsForProject(req, res, next) {
        try {
            // Get all chats for the project
        } catch (error) {
            next(error);
        }
    }

    // GET /api/chats/:chatId/messages
    static async getMessages(req, res, next) {
        try {
            // Get paginated messages
        } catch (error) {
            next(error);
        }
    }

    // POST /api/chats/:chatId/messages
    static async sendMessage(req, res, next) {
        try {
            // {
            //     chatId,
            //     senderId,
            //     text,
            //     attachments
            // }
        } catch (error) {
            next(error);
        }
    }

    // PATCH /api/messages/:messageId/read
    static async markAsRead(req, res, next) {
        try {
            // Mark message as read
        } catch (error) {
            next(error);
        }
    }
}

export default ChatController;