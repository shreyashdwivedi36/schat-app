const assert = require('assert');
const { hashPassword, comparePassword, generateToken, verifyToken } = require('./auth');
const db = require('./db');

console.log('🧪 Running Complete SChat 9-Feature Automated Test Suite...\n');

async function runAllTests() {
  try {
    // 1. Password Hashing & Verification
    console.log('Test 1: Password Hashing & Verification');
    const rawPwd = 'secretPassword123';
    const hash = hashPassword(rawPwd);
    assert.strictEqual(comparePassword(rawPwd, hash), true, 'Valid password verification must return true');
    assert.strictEqual(comparePassword('wrongPassword', hash), false, 'Invalid password verification must return false');
    console.log('✅ Passed Test 1\n');

    // 2. JWT Token Issuance & Verification
    console.log('Test 2: JWT Token Issuance & Payload Verification');
    const mockUser = { id: 99, username: 'testuser', email: 'test@example.com', avatar: '⚡', bio: 'Hello SChat' };
    const token = generateToken(mockUser);
    assert.ok(token, 'Token string must be issued');
    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, 99, 'Token payload user ID must match');
    assert.strictEqual(decoded.username, 'testuser', 'Token payload username must match');
    assert.strictEqual(verifyToken('invalid.jwt.token'), null, 'Invalid token verification must return null');
    console.log('✅ Passed Test 2\n');

    // 3. User Registration & Profile Settings
    console.log('Test 3: User Registration & Profile Bio Update');
    const ts = Date.now();
    const unameA = `alice_${ts}`;
    const emailA = `alice_${ts}@test.com`;
    const userA = await db.run(
      'INSERT INTO users (username, email, password, avatar, bio) VALUES (?, ?, ?, ?, ?)',
      [unameA, emailA, hash, '⚡', 'Initial bio']
    );
    assert.ok(userA.id, 'Registered user must receive a valid ID');

    await db.run('UPDATE users SET bio = ? WHERE id = ?', ['Updated bio text', userA.id]);
    const updatedUser = await db.get('SELECT bio FROM users WHERE id = ?', [userA.id]);
    assert.strictEqual(updatedUser.bio, 'Updated bio text', 'Bio update must persist in database');
    console.log('✅ Passed Test 3\n');

    // 4. Message Creation, Editing & Pinning
    console.log('Test 4: Message Editing & Pinning');
    const msg = await db.run(
      'INSERT INTO messages (user_id, recipient_id, channel, username, avatar, content) VALUES (?, ?, ?, ?, ?)',
      [userA.id, null, 'global', unameA, '⚡', 'Original message content']
    );
    assert.ok(msg.id, 'Message creation must return ID');

    await db.run('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ? AND user_id = ?', ['Edited content text', msg.id, userA.id]);
    const editedMsg = await db.get('SELECT content, is_edited FROM messages WHERE id = ?', [msg.id]);
    assert.strictEqual(editedMsg.content, 'Edited content text', 'Edited content must persist');
    assert.strictEqual(editedMsg.is_edited, 1, 'is_edited flag must be set to 1');

    await db.run('UPDATE messages SET is_pinned = 1 WHERE id = ?', [msg.id]);
    const pinnedMsg = await db.get('SELECT is_pinned FROM messages WHERE id = ?', [msg.id]);
    assert.strictEqual(pinnedMsg.is_pinned, 1, 'is_pinned flag must be set to 1');
    console.log('✅ Passed Test 4\n');

    // 5. Message Reactions & Quoted Replies
    console.log('Test 5: Message Reactions & Quoted Replies');
    const rxObj = JSON.stringify({ '👍': [unameA] });
    await db.run('UPDATE messages SET reactions = ? WHERE id = ?', [rxObj, msg.id]);
    const rxMsg = await db.get('SELECT reactions FROM messages WHERE id = ?', [msg.id]);
    assert.ok(rxMsg.reactions.includes(unameA), 'Reactions JSON must include username');

    const replyMsg = await db.run(
      'INSERT INTO messages (user_id, recipient_id, channel, username, avatar, content, reply_to_id, reply_to_user, reply_to_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userA.id, null, 'global', unameA, '⚡', 'Reply message', msg.id, unameA, 'Edited content text']
    );
    const fetchedReply = await db.get('SELECT reply_to_text FROM messages WHERE id = ?', [replyMsg.id]);
    assert.strictEqual(fetchedReply.reply_to_text, 'Edited content text', 'Quoted reply text must match parent message');
    console.log('✅ Passed Test 5\n');

    // 6. User Blocking & Unblocking
    console.log('Test 6: User Blocking & Unblocking');
    const unameB = `bob_${ts}`;
    const emailB = `bob_${ts}@test.com`;
    const userB = await db.run(
      'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)',
      [unameB, emailB, hash, '🚀']
    );

    await db.run('INSERT INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)', [userA.id, userB.id]);
    const blockedList = await db.all('SELECT * FROM blocked_users WHERE blocker_id = ?', [userA.id]);
    assert.strictEqual(blockedList.length, 1, 'Blocked users list should contain 1 entry');

    await db.run('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', [userA.id, userB.id]);
    const unblockedList = await db.all('SELECT * FROM blocked_users WHERE blocker_id = ?', [userA.id]);
    assert.strictEqual(unblockedList.length, 0, 'Unblocked list should be empty');
    console.log('✅ Passed Test 6\n');

        // 7. Change Password Test
    console.log('Test 7: Password Change & Verification');
    const newPwdRaw = 'brandNewPassword456';
    const newHash = hashPassword(newPwdRaw);
    await db.run('UPDATE users SET password = ? WHERE id = ?', [newHash, userA.id]);
    const userA_updated = await db.get('SELECT password FROM users WHERE id = ?', [userA.id]);
    assert.strictEqual(comparePassword(newPwdRaw, userA_updated.password), true, 'User password must be updated to new hash');
    assert.strictEqual(comparePassword('secretPassword123', userA_updated.password), false, 'Old password must no longer verify');
    console.log('✅ Passed Test 7\n');

    console.log('🎉 ALL 7 EXPANDED TEST SUITES PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runAllTests();
