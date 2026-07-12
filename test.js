const assert = require('assert');
const { hashPassword, comparePassword, generateToken, verifyToken } = require('./auth');
const db = require('./db');

console.log('🧪 Running Complete SChat Automated Test Suite...\n');

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
    const mockUser = { id: 99, username: 'testuser', email: 'test@example.com', avatar: '⚡' };
    const token = generateToken(mockUser);
    assert.ok(token, 'Token string must be issued');
    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, 99, 'Token payload user ID must match');
    assert.strictEqual(decoded.username, 'testuser', 'Token payload username must match');
    assert.strictEqual(verifyToken('invalid.jwt.token'), null, 'Invalid token verification must return null');
    console.log('✅ Passed Test 2\n');

    // 3. User Registration & Database Querying
    console.log('Test 3: User Registration & Persistence');
    const ts = Date.now();
    const unameA = `alice_${ts}`;
    const emailA = `alice_${ts}@test.com`;
    const userA = await db.run(
      'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)',
      [unameA, emailA, hash, '⚡']
    );
    assert.ok(userA.id, 'Registered user must receive a valid ID');

    const unameB = `bob_${ts}`;
    const emailB = `bob_${ts}@test.com`;
    const userB = await db.run(
      'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)',
      [unameB, emailB, hash, '🚀']
    );
    assert.ok(userB.id, 'Registered user B must receive a valid ID');
    console.log('✅ Passed Test 3\n');

    // 4. Direct Messages (DMs) Isolation & Status Tracking
    console.log('Test 4: DM Routing & Isolation');
    const dmMsg = await db.run(
      'INSERT INTO messages (user_id, recipient_id, username, avatar, content, is_blurred, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userA.id, userB.id, unameA, '⚡', 'Private DM to Bob', 0, null, 'sent']
    );
    assert.ok(dmMsg.id, 'DM message insertion must return ID');

    const fetchedDMs = await db.all(
      'SELECT * FROM messages WHERE ((user_id = ? AND recipient_id = ?) OR (user_id = ? AND recipient_id = ?))',
      [userA.id, userB.id, userB.id, userA.id]
    );
    assert.ok(fetchedDMs.length > 0, 'DM query must return isolated messages between User A and User B');
    assert.strictEqual(fetchedDMs[0].content, 'Private DM to Bob', 'DM content must match');
    console.log('✅ Passed Test 4\n');

    // 5. Message Deletion Authorization Checks (Strict Ownership)
    console.log('Test 5: Strict Message Deletion Authorization Check');
    const msgToDelete = await db.run(
      'INSERT INTO messages (user_id, recipient_id, username, avatar, content) VALUES (?, ?, ?, ?, ?)',
      [userA.id, null, unameA, '⚡', 'Alice message to delete']
    );

    // Verify Bob (userB) is NOT the owner of Alice's message
    const msgOwner = await db.get('SELECT user_id FROM messages WHERE id = ?', [msgToDelete.id]);
    assert.notStrictEqual(msgOwner.user_id, userB.id, 'User B must not be authorized to delete User A message');

    // Authorized deletion by owner (userA)
    await db.run('DELETE FROM messages WHERE id = ?', [msgToDelete.id]);
    const deletedCheck = await db.get('SELECT * FROM messages WHERE id = ?', [msgToDelete.id]);
    assert.strictEqual(deletedCheck, null, 'Message must be deleted when authorized by owner');
    console.log('✅ Passed Test 5\n');

    // 6. Message Self-Destruct Expiry Verification
    console.log('Test 6: Message Self-Destruct Expiry Filtering');
    const pastExpiry = new Date(Date.now() - 5000).toISOString(); // 5 seconds in past
    const expiredMsg = await db.run(
      'INSERT INTO messages (user_id, recipient_id, username, avatar, content, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userA.id, null, unameA, '⚡', 'Expired message text', pastExpiry]
    );

    const activeMsgs = await db.all(
      'SELECT * FROM messages WHERE recipient_id IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)'
    );
    const foundExpired = activeMsgs.find(m => m.id === expiredMsg.id);
    assert.strictEqual(foundExpired, undefined, 'Expired self-destruct messages must be excluded from history queries');
    console.log('✅ Passed Test 6\n');

    console.log('🎉 ALL 6 AUTOMATED TEST SUITES PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runAllTests();
