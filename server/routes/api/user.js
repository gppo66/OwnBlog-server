import express from 'express';
import bcrypt from 'bcryptjs';

import jwt from 'jsonwebtoken';
import config from '../../config/index';
const { JWT_SECRET } = config;
//Model
import User from '../../models/user';
import auth from '../../middleware/auth';

const router = express.Router();

// @routes GET api/user
// @desc Get all user
// @access public

router.get('/', async (req, res) => {
  try {
    const users = await User.find();
    if (!users) throw Error('No Users');
    res.status(200).json(users);
  } catch (e) {
    console.log(e);
    res.status(400).json({ msg: e.message });
  }
});

// @routes POST api/user
// @desc Register user
// @access public

router.post('/', (req, res) => {
  console.log(req);
  const { name, email, password, repassword } = req.body;

  // Simple validation
  if (!name || !email || !password) {
    return res.status(400).json({ msg: '모든 필드를 채워주세요' });
  }
  // check for password and repassword match
  if (password !== repassword) {
    return res.status(400).json({ msg: '패스워드가 일치하지 않습니다.' });
  }
  // Check for existing user
  User.findOne({ email }).then((user) => {
    if (user)
      return res.status(400).json({ msg: '이미 가입된 유저가 존재합니다.' });
  });
  const newUser = new User({
    name,
    email,
    password,
  });

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(newUser.password, salt, (err, hash) => {
      if (err) throw err;
      newUser.password = hash;
      newUser.save().then((user) => {
        jwt.sign(
          { id: newUser.id },
          JWT_SECRET,
          { expiresIn: 3600 },
          (err, token) => {
            if (err) throw err;
            res.json({
              token,
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
              },
            });
          },
        );
      });
    });
  });
});

// @route    POST   api/user/:username/profile
// @desc     POST   Edit Password
// @access   Private

router.post('/:userName/profile', auth, async (req, res) => {
  try {
    const {
      previousPassword,
      password,
      rePassword,
      userId,
      newUserName,
      userName,
    } = req.body;
    console.log(req.body, 'userName Profile');
    const result = await User.findById(userId);
    console.log(result, 'result infomation');
    bcrypt.compare(previousPassword, result.password).then((isMatch) => {
      if (!isMatch) {
        return res.status(400).json({
          match_msg: '기존 비밀번호와 일치하지 않습니다',
        });
      } else {
        if (result.name !== req.body.newUserName) {
          result.name = req.body.newUserName;
          result.save();
          if (password === null || rePassword === null) {
            res.status(200).json({ success_msg: '이름 수정에 성공했습니다' });
          } else {
            res.status(400).json({ fail_msg: '정보를 다 입력해주세요' });
          }
        }
        if (password !== null || rePassword !== null) {
          if (password === rePassword) {
            bcrypt.genSalt(10, (err, salt) => {
              bcrypt.hash(password, salt, (err, hash) => {
                if (err) throw err;
                result.password = hash;
                result.save();
              });
            });
            res
              .status(200)
              .json({ success_msg: '개인정보 업데이트에 성공했습니다' });
          } else {
            res
              .status(400)
              .json({ fail_msg: '새로운 비밀번호가 일치하지 않습니다' });
          }
        } else {
          res.status(400).json({ fail_msg: '정보를 다 입력해주세요' });
        }
      }
    });
  } catch (e) {
    console.log(e);
  }
});
export default router;
