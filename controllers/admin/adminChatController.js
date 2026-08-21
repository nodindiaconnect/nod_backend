import helper from "../../helper/helper.js";
import AdminManagementService from "../../services/adminManagementService.js";

class AdminChatController {
    /**
     * Get all chat channels across the system
     * GET /api/Admin/chats
     */
    static async getAllChats(req, res, next) {
        try {
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
            const skip = (page - 1) * limit;

            const result = await AdminManagementService.getAllChatsAdmin({
                page,
                limit,
                skip,
                projectId: req.query.projectId,
                type: req.query.type,
                search: req.query.search,
            });

            return helper.success(res, "Chats metadata fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * View messages in a chat channel
     * GET /api/Admin/chats/:chatId/messages
     */
    static async getChatMessages(req, res, next) {
        try {
            const { chatId } = req.params;
            const result = await AdminManagementService.getChatMessagesAdmin(chatId, req.query);
            return helper.success(res, "Chat messages fetched successfully", result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }

    /**
     * Moderate / delete a message
     * DELETE /api/Admin/chats/messages/:messageId
     */
    static async deleteMessage(req, res, next) {
        try {
            const { messageId } = req.params;
            const { reason } = req.body;

            const result = await AdminManagementService.deleteMessageAdmin(
                req.admin,
                messageId,
                { reason },
                req
            );

            return helper.success(res, result.message, result);
        } catch (error) {
            return helper.failed(res, error.message, {}, 400);
        }
    }
}

export default AdminChatController;
