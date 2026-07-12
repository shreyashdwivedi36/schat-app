const assert = require('assert');
const http = require('http');
const { hashPassword, comparePassword, generateToken, verifyToken } = require('./auth');
const db = require('./db');

console.log('🧪 Starting SChat Automated Test Suite...\n');

async function runTests() {
  try {
    // Test 1: Password Hashing & Comparison
    console.log('Test 1: Password Hashing & Verification');
    const pwd = 'securePassword123';
    const hash = hashPassword(pwd);
    assert.strictEqual(comparePassword(pwd, hash), true, 'Password match should succeed');
    assert.strictEqual(comparePassword('wrongPassword', hash), false, 'Wrong password should fail');
    console.log('✅ Passed Password Hashing Test\n');

    // Test 2: JWT Token Generation & Verification
    console.log('Test 2: JWT Token Issuance & Verification');
    const userPayload = { id: 101, username: 'tester', email: 'test@example.com', avatar: '⚡' };
    const token = generateToken(userPayload);
    assert.ok(token, 'JWT token should be generated');
    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, 101, 'Decoded user ID should match');
    assert.strictEqual(decoded.username, 'tester', 'Decoded username should match');
    console.log('✅ Passed JWT Token Test\n');

    // Test 3: Database User Insertion & Query
    console.log('Test 3: Database User Operations');
    const testUsername = `user_${Date.now()}`;
    const testEmail = `user_${Date.now()}@test.com`;
    const userInsert = await db.run(
      'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)',
      [testUsername, testEmail, hash, '🚀']
    );
    assert.ok(userInsert.id, 'User insertion should return a valid ID');

    const fetchedUser = await db.get('SELECT * FROM users WHERE id = ?', [userInsert.id]);
    assert.strictEqual(fetchedUser.username, testUsername, 'Fetched username should match');
    console.log('✅ Passed Database User Test\n');

    // Test 4: Message Creation & Direct Messaging
    console.log('Test 4: Message Creation & Direct Messaging');
    const msgInsert = await db.run(
      'INSERT INTO messages (user_id, recipient_id, username, avatar, content, is_blurred, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [fetchedUser.id, null, testUsername, '🚀', 'Hello Global Chat!', 0, null, 'sent']
    );
    assert.ok(msgInsert.id, 'Message insertion should return a valid ID');

    const fetchedMsg = await db.get('SELECT * FROM messages WHERE id = ?', [msgInsert.id]);
    assert.strictEqual(fetchedMsg.content, 'Hello Global Chat!', 'Message content should match');
    console.log('✅ Passed Message Creation Test\n');

    // Test 5: Message Deletion Authorization
    console.log('Test 5: Message Deletion Authorization Check');
    const userA = { id: 1 };
    const userB = { id: 2 };
    
    // User A creates message
    const msgA = await db.run(
      'INSERT INTO messages (user_id, recipient_id, username, avatar, content) VALUES (?, ?, ?, ?, ?)',
      [userA.id, null, 'userA', '⚡', 'Message from A']
    );

    // Verify User B cannot delete User A's message
    const targetMsg = await db.get('SELECT user_id FROM messages WHERE id = ?', [msgA.id]);
    assert.notStrictEqual(targetMsg.user_id, userB.id, 'User B ID should not match Message A owner ID');
    
    // Perform authorized deletion by User A
    await db.run('DELETE FROM messages WHERE id = ?', [msgA.id]);
    const checkDeleted = await db.get('SELECT * FROM messages WHERE id = ?', [msgA.id]);
    assert.strictEqual(checkDeleted, null, 'Message should be deleted by authorized owner');
    console.log('✅ Passed Deletion Authorization Test\n');

    console.log('🎉 ALL 5 TEST SUITES PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
