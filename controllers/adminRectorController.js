const db = require('../config/database');
const bcrypt = require('bcryptjs');

const findRector = async (id) => {
  const [rows] = await db.query('SELECT id, rector_id, name, email, phone, password, status, photo, salary FROM rectors WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
};

exports.getRectors = async (req, res) => {
  try {
    const [rectors] = await db.query('SELECT id, rector_id, name, email, phone,  status, photo, salary FROM rectors ORDER BY id DESC');
    res.json({ success: true, rectors });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to fetch rectors.', error: error.message }); }
};

exports.getRector = async (req, res) => {
  try {
    const rector = await findRector(req.params.id);
    if (!rector) return res.status(404).json({ success: false, message: 'Rector not found.' });
    delete rector.password;
    res.json({ success: true, rector });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to fetch rector.', error: error.message }); }
};

exports.addRector = async (req, res) => {
  try {
    const { rector_id, name, email, phone, mobile, password, status, salary } = req.body;
    const cleanPhone = String(phone ?? mobile ?? '').trim();
    if (!rector_id || !name || !email || !password  || salary === undefined || salary === '') return res.status(400).json({ success: false, message: 'Rector ID, name, email, password and salary are required.' });
    const cleanEmail = String(email).trim().toLowerCase();
    const [dup] = await db.query('SELECT id FROM rectors WHERE rector_id = ? OR email = ? LIMIT 1', [String(rector_id).trim(), cleanEmail]);
    if (dup.length) return res.status(409).json({ success: false, message: 'Rector ID or email already exists.' });
    const hashed = await bcrypt.hash(String(password), 10);
    const photo = req.file ? `rectors/${req.file.filename}` : null;
    const [result] = await db.query('INSERT INTO rectors (rector_id,name,email,phone,password,status,photo,salary) VALUES (?,?,?,?,?,?,?,?)', [String(rector_id).trim(), String(name).trim(), cleanEmail, cleanPhone || null, hashed, String(status || 'active').toLowerCase(), photo, Number(salary)]);
    res.status(201).json({ success: true, message: 'Rector added successfully.', rector: await findRector(result.insertId) });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to add rector.', error: error.message }); }
};

exports.updateRector = async (req, res) => {
  try {
    const old = await findRector(req.params.id);
    if (!old) return res.status(404).json({ success: false, message: 'Rector not found.' });
    const { rector_id, name, email, phone, mobile, password, status, salary } = req.body;
    const cleanPhone = String(phone ?? mobile ?? '').trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const [dup] = await db.query('SELECT id FROM rectors WHERE (rector_id = ? OR email = ?) AND id <> ? LIMIT 1', [String(rector_id).trim(), cleanEmail, req.params.id]);
    if (dup.length) return res.status(409).json({ success: false, message: 'Rector ID or email already exists.' });
    const hashed = password && String(password).trim() ? await bcrypt.hash(String(password), 10) : old.password;
    const photo = req.file ? `rectors/${req.file.filename}` : old.photo;
    await db.query('UPDATE rectors SET rector_id=?,name=?,email=?,phone=?,password=?,status=?,photo=?,salary=? WHERE id=?', [String(rector_id).trim(), String(name).trim(), cleanEmail, cleanPhone || null, hashed, String(status || 'active').toLowerCase(), photo, Number(salary), req.params.id]);
    res.json({ success: true, message: 'Rector updated successfully.', rector: await findRector(req.params.id) });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to update rector.', error: error.message }); }
};

exports.updateRectorStatus = async (req, res) => {
  try {
    const rector = await findRector(req.params.id);
    if (!rector) return res.status(404).json({ success: false, message: 'Rector not found.' });
    const status = String(req.body.status || '').toLowerCase();
    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
    await db.query('UPDATE rectors SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true, message: 'Rector status updated.', rector: await findRector(req.params.id) });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to update status.', error: error.message }); }
};
