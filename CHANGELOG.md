# Changelog

All notable changes to this project will be documented in this file.

## [v1.1.0] - 2026-08-18

### ? Added
- **Read Receipts & Delivery Status**: Implemented a complete pipeline for message statuses. Messages now progress from Sent (?) to Delivered (?? grey) and Read (?? blue), mirroring WhatsApp.
- **Privacy-Focused Contacts**: The sidebar now defaults to showing only users you have previously chatted with, preventing strangers from cluttering your view.
- **Global Search**: The search bar instantly queries the global user registry. Searching and messaging a new user automatically permanently adds them to your recent chats list.
- **Real-Time Typing Indicators**: Added real-time indicators scoped accurately to active 1-on-1 conversations.

### ?? Fixed
- Phantom typing indicators appearing across all active clients.
- Status synchronisation issues across active tabs.
