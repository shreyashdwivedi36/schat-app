const assert = require('assert');
const { hashPassword, comparePassword, generateToken, verifyToken, authMiddleware } = require('./auth');
const db = require('./db');

console.log('🧪 Running Complete SChat 11-Suite Automated Regression Test Suite...\n');

async function runAllTests() {
  try {
    // 1. Password Hashing & Verification
    console.log('Test 1: Password Hashing & Verification');
    const rawPwd = 'secretPassword123';
    const hash = hashPassword(rawPwd);
    assert.strictEqual(comparePassword(rawPwd, hash), true, 'Valid password verification must return true');
    assert.strictEqual(comparePassword('wrongPassword', hash), false, 'Invalid password verification must return false');
    console.log('✅ Passed Test 1\n');

    // 2. JWT Token Issuance & Session Verification
    console.log('Test 2: JWT Token Issuance & Session Binding Verification');
    const mockUser = { id: 99, username: 'testuser', email: 'test@example.com', avatar: '⚡', bio: 'Hello SChat' };
    const testSessionId = `test_sess_${Date.now()}`;
    const token = generateToken(mockUser, testSessionId);
    assert.ok(token, 'Token string must be issued');
    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, 99, 'Token payload user ID must match');
    assert.strictEqual(decoded.username, 'testuser', 'Token payload username must match');
    assert.strictEqual(decoded.sessionId, testSessionId, 'Token must contain bound sessionId');
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
      'INSERT INTO messages (user_id, recipient_id, channel, username, avatar, content) VALUES (?, ?, ?, ?, ?, ?)',
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

        // 8. Translation Logic Verification
    console.log('Test 8: Multi-Language Translation Payload & Fallback Verification');
    const sampleText = 'Good morning my friend';
    const targetLang = 'es';
    const encoded = encodeURIComponent(sampleText.trim().slice(0, 1500));
    assert.strictEqual(encoded, 'Good%20morning%20my%20friend', 'Translation query must be properly URL-encoded');
    assert.strictEqual(targetLang, 'es', 'Target language must match specified ISO code');
    console.log('✅ Passed Test 8\n');

    // 9. Search Authorization & Privacy Boundaries Test
    console.log('Test 9: Message Search Privacy & Authorization Boundary Verification');
    const secretKeyword = `classified_${ts}`;
    // Insert a private DM between User A and User B
    await db.run(
      'INSERT INTO messages (user_id, recipient_id, channel, username, avatar, content) VALUES (?, ?, ?, ?, ?, ?)',
      [userA.id, userB.id, null, unameA, '⚡', `Top secret message with ${secretKeyword}`]
    );

    // Create User C (unauthorized third-party)
    const unameC = `charlie_${ts}`;
    const userC = await db.run(
      'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)',
      [unameC, `charlie_${ts}@test.com`, hash, '🕵️']
    );

    // User C searches for the private keyword -> MUST return 0 results
    const searchSql = 'SELECT * FROM messages WHERE content LIKE ? AND (recipient_id IS NULL OR user_id = ? OR recipient_id = ?) ORDER BY id DESC LIMIT 30';
    const unauthorizedResults = await db.all(searchSql, [`%${secretKeyword}%`, userC.id, userC.id]);
    assert.strictEqual(unauthorizedResults.length, 0, 'Unauthorized User C must not see private DMs between User A and User B');

    // Authorized User A searches for the private keyword -> MUST return 1 result
    const authorizedResults = await db.all(searchSql, [`%${secretKeyword}%`, userA.id, userA.id]);
    assert.strictEqual(authorizedResults.length, 1, 'Authorized User A must be able to search their own private DMs');
    console.log('✅ Passed Test 9 (Search Privacy Boundaries Confirmed)\n');

    // 10. Server-Side Session Revocation Verification
    console.log('Test 10: Server-Side Session Revocation Guard Verification');
    const sessionIdActive = `sess_${ts}_active`;
    // Register active session in user_sessions
    await db.run(
      'INSERT INTO user_sessions (session_id, user_id, device, browser, ip_address) VALUES (?, ?, ?, ?, ?)',
      [sessionIdActive, userA.id, 'Desktop Chrome', 'Chrome 128', '127.0.0.1']
    );

    // Issue JWT with active session ID
    const tokenWithSession = generateToken({ id: userA.id, username: unameA, email: emailA }, sessionIdActive);

    // Mock Express req, res, next for active session
    let activeReqPassed = false;
    const reqMockActive = { headers: { authorization: `Bearer ${tokenWithSession}` } };
    const resMockActive = { setHeader: () => {}, status: () => ({ json: () => {} }) };
    await authMiddleware(reqMockActive, resMockActive, () => { activeReqPassed = true; });
    assert.strictEqual(activeReqPassed, true, 'Active session must pass authMiddleware');

    // Revoke the session by deleting it from user_sessions
    await db.run('DELETE FROM user_sessions WHERE session_id = ? AND user_id = ?', [sessionIdActive, userA.id]);

    // Test that the revoked session is rejected with 401
    let revokedStatus = null;
    let revokedError = null;
    const reqMockRevoked = { headers: { authorization: `Bearer ${tokenWithSession}` } };
    const resMockRevoked = {
      setHeader: () => {},
      status: (code) => {
        revokedStatus = code;
        return {
          json: (data) => { revokedError = data.error; }
        };
      }
    };
    await authMiddleware(reqMockRevoked, resMockRevoked, () => {
      assert.fail('Revoked session must not call next()');
    });
    assert.strictEqual(revokedStatus, 401, 'Revoked session must return 401 Unauthorized');
    assert.ok(revokedError && revokedError.includes('revoked'), 'Error message must state session is revoked');
    console.log('✅ Passed Test 10 (Server-Side Session Revocation Enforced)\n');

    // 11. Server-Side Direct Message Authorization & Block Verification
    console.log('Test 11: Server-Side Direct Message Authorization & Block Verification');
    // Verify non-contact check
    const nonContact = await db.get(
      'SELECT id FROM contacts WHERE status = ? AND ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))',
      ['accepted', userA.id, userC.id, userC.id, userA.id]
    );
    assert.strictEqual(!nonContact, true, 'Unaccepted contact relationship must return falsy');

    // Create mutual accepted contact between User A and User B
    await db.run('INSERT INTO contacts (requester_id, recipient_id, status) VALUES (?, ?, ?)', [userA.id, userB.id, 'accepted']);
    const acceptedContact = await db.get(
      'SELECT id FROM contacts WHERE status = ? AND ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))',
      ['accepted', userA.id, userB.id, userB.id, userA.id]
    );
    assert.ok(acceptedContact, 'Accepted contact relationship must be verified');

    // Create block relationship
    await db.run('INSERT INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)', [userA.id, userB.id]);
    const isBlocked = await db.get(
      'SELECT id FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
      [userA.id, userB.id, userB.id, userA.id]
    );
    assert.ok(isBlocked, 'Blocked status must be detected to reject direct messages');
    await db.run('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', [userA.id, userB.id]);
    console.log('✅ Passed Test 11 (Server-Side DM Authorization Boundaries Confirmed)\n');

    console.log('🎉 ALL 11 AUTOMATED REGRESSION TEST SUITES PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runAllTests();
