import express from 'express';
import auth from '../../middleware/auth';
import moment from 'moment';
// Model
import Post from '../../models/post';
import Category from '../../models/category';
import User from '../../models/user';
import Comment from '../../models/comment';
import '@babel/polyfill';

const router = express.Router();

import multerS3 from 'multer-s3';
import path from 'path';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import multer from 'multer';

import { Mongoose } from 'mongoose';

dotenv.config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_KEY,
  secretAccessKey: process.env.AWS_PRIVATE_KEY,
});

const uploadS3 = multer({
  storage: multerS3({
    s3,
    bucket: 'jellybearblog/upload',
    region: 'ap-northeast-2',
    key(req, file, cb) {
      const ext = path.extname(file.originalname);
      const basename = path.basename(file.originalname, ext);
      cb(null, basename + new Date().valueOf() + ext);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

//@route POST api/post/image
//@desc Create a Post
//@access  Private
router.post('/image', uploadS3.array('upload', 5), async (req, res, next) => {
  try {
    console.log(req.files.map((v) => v.loaction));
    res.json({ uploaded: true, url: req.files.map((v) => v.location) });
  } catch (e) {
    console.error(e);
    res.json({ uploaded: false, url: null });
  }
});

// @route GET api/post
// @desc More Loading Posts
// @access Public
router.get('/skip/:skip', async (req, res) => {
  try {
    const postCount = await Post.countDocuments();
    const postFindResult = await Post.find()
      .skip(Number(req.params.skip))
      .limit(6)
      .sort({ date: -1 });

    const categoryFindResult = await Category.find();
    const result = { postFindResult, categoryFindResult, postCount };
    res.json(result);
  } catch (e) {
    console.error(e);
    res.json({ msg: ' 더 이상 포스트가 없습니다.' });
  }
});

// @route POST api/post
// @desc Create a Post
//@access  Private
router.post('/', auth, uploadS3.none(), async (req, res, next) => {
  try {
    console.log(req, 'req');
    const { title, contents, fileUrl, creator, category } = req.body;
    const newPost = await Post.create({
      title,
      contents,
      fileUrl,
      creator: req.user.id,
      date: moment().format('YYYY-MM-DD hh:mm:ss'),
    });

    const findResult = await Category.findOne({
      categoryName: category,
    });

    console.log(findResult, ' Find Result ');

    if (findResult === null || findResult === undefined) {
      const newCategory = await Category.create({
        categoryName: category,
      });
      await Post.findByIdAndUpdate(newPost._id, {
        $push: { category: newCategory._id },
      });
      await Category.findByIdAndUpdate(newCategory._id, {
        $push: { posts: newPost._id },
      });
      await User.findByIdAndUpdate(req.user.id, {
        $push: {
          posts: newPost._id,
        },
      });
    } else {
      await Category.findByIdAndUpdate(findResult._id, {
        $push: { posts: newPost._id },
      });
      await Post.findByIdAndUpdate(newPost._id, {
        category: findResult._id,
      });
      await User.findByIdAndUpdate(req.user.id, {
        $push: {
          posts: newPost._id,
        },
      });
    }
    console.log(newPost._id, ' new Post ');
    return res.redirect(`/api/post/${newPost._id}`);
  } catch (e) {
    console.log(e);
  }
});

// @route Post api/post/:id
// @desc Detail Post
// @access Public
router.get('/:id', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('creator', 'name')
      .populate({ path: 'category', select: 'categoryName' });
    post.views += 1;
    post.save();
    console.log(post);
    res.json(post);
  } catch (e) {
    console.error(e);
    next(e);
  }
});

// [Comments Route]

// @route Get api/post/:id/comments
// @desc  Get All Comments
// @access public

router.get('/:id/comments', async (req, res) => {
  try {
    const comment = await Post.findById(req.params.id).populate({
      path: 'comments',
    });
    const result = comment.comments;
    console.log(result, 'comment load');
    res.json(result);
  } catch (e) {
    console.log(e);
  }
});

router.post('/:id/comments', async (req, res, next) => {
  console.log(req, 'comments');
  const newComment = await Comment.create({
    contents: req.body.contents,
    creator: req.body.userId,
    creatorName: req.body.userName,
    post: req.body.id,
    date: moment().format('YYYY-MM-DD hh:mm:ss'),
  });
  console.log(newComment, 'newComment');

  try {
    await Post.findByIdAndUpdate(req.body.id, {
      $push: {
        comments: newComment._id,
      },
    });
    await User.findByIdAndUpdate(req.body.userId, {
      $push: {
        comments: {
          post_id: req.body.id,
          comment_id: newComment._id,
        },
      },
    });
    res.json(newComment);
  } catch (e) {
    console.log(e);
    next(e);
  }
});
// [Comments Route]

// @route Delete api/post/:id/comments/:id
// @desc  Delte Comment
// @access Private
router.delete('/:id/comments/:id', auth, async (req, res) => {
  const commentInfo = await Comment.findById({ _id: req.params.id });
  console.log(commentInfo, 'Comment information');
  console.log(req.params, ' req information');
  const postId = commentInfo.post;
  const userId = commentInfo.creator._id;
  console.log(postId, 'postId');
  console.log(userId, 'userId');
  await Comment.deleteMany({ _id: req.params.id });
  const result = await User.findByIdAndUpdate(userId, {
    $pull: {
      comments: { comment_id: req.params.id },
    },
  });
  //console.log(result, ' User Result');
  const result2 = await Post.findByIdAndUpdate(postId, {
    $pull: {
      comments: req.params.id,
    },
  });
  //console.log(result2, ' Post Result');
  const comment = await Post.findById(postId).populate({
    path: 'comments',
  });
  const result3 = comment.comments;
  //console.log(result3, 'comment load');
  res.json(result3);
});
// [Comments Route]

// @route Edit api/post/:id/comments/:id
// @desc  Edit Comment
// @access Private
router.post('/:id/comments/:id', auth, async (req, res) => {
  const commentInfo = await Comment.findById({ _id: req.params.id });
  console.log(commentInfo, 'Comment information');
  const postId = commentInfo.post;
  const userId = commentInfo.creator._id;
  console.log(postId, 'postId');
  console.log(userId, 'userId');
  await Comment.findByIdAndUpdate(req.params.id, {
    $push: {
      //contents : req.params.,
    },
  });

  //console.log(result2, ' Post Result');
  const comment = await Post.findById(postId).populate({
    path: 'comments',
  });
  const result3 = comment.comments;
  //console.log(result3, 'comment load');
  res.json(result3);
});

// @route Delete api/post/:id
// @desc Delete a Post
// @access private

router.delete('/:id', auth, async (req, res) => {
  await Post.deleteMany({ _id: req.params.id });
  await Comment.deleteMany({ post: req.params.id });
  await User.findByIdAndUpdate(req.user.id, {
    $pull: {
      posts: req.params.id,
      comments: { post_id: req.params.id },
    },
  });
  const CategoryUpdateResult = await Category.findOneAndUpdate(
    { posts: req.params.id },
    { $pull: { posts: req.params.id } },
    { new: true },
  );

  if (CategoryUpdateResult.posts.length === 0) {
    await Category.deleteMany({ _id: CategoryUpdateResult });
  }
  return res.json({ success: true });
});

// @route Get api/post/:id/edit
// @desc Edit Post
// @access private

router.get('/:id/edit', auth, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('creator', 'name');
    res.json(post);
  } catch (e) {
    console.error(e);
  }
});

router.post('/:id/edit', auth, async (req, res, next) => {
  console.log(req, 'api/post/:id/edit');
  const {
    body: { title, contents, fileUrl, id },
  } = req;
  try {
    const modified_post = await Post.findByIdAndUpdate(
      id,
      {
        title,
        contents,
        fileUrl,
        date: moment().format('YYYY-MM-DD hh:mm:ss'),
      },
      { new: true },
    );
    console.log(modified_post, 'edit modified');
    res.redirect(`/api/post/${modified_post.id}`);
  } catch (e) {
    console.error(e);
    next(e);
  }
});

router.get('/category/:categoryName', async (req, res, next) => {
  try {
    const result = await Category.findOne(
      {
        categoryName: {
          $regex: req.params.categoryName,
          $options: 'i',
        },
      },
      'posts',
    ).populate({ path: 'posts' });
    console.log(result, 'Category Find result');
    res.send(result);
  } catch (e) {
    console.log(e);
    next(e);
  }
});

export default router;
