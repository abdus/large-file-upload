import os from "os";
import fs from "fs";
import path from "path";
import multer from "multer";
import express from "express";
import mimeTypes from "mime-types";

const server = express();
const upload = multer({ dest: "upload/" });

server.use(express.json({ limit: "100mb" }));
server.use(express.urlencoded({ limit: "100mb", extended: true }));
server.use("/", express.static(path.resolve("static")));

/**
 * merge multiple file segments into one
 * @param {fs.PathLike} dest
 * @param {string} extName
 */
function mergeFile(dest, extName) {
  const files = fs
    .readdirSync(dest)
    .sort((a, b) => (parseInt(a) > parseInt(b) ? 1 : -1));

  for (let i = 0; i < files.length; i++) {
    const chunkPath = path.join(dest, files[i]);
    const chunkContent = fs.readFileSync(chunkPath);

    fs.appendFileSync(path.join(dest, "merged." + extName), chunkContent);
    //fs.unlinkSync(chunkPath);
  }

  return path.resolve(path.join(dest, "merged." + extName));
}

server.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    const fileId = req.body.fileId;
    const uploadedFileName = req.file.path;
    const destDir = path.join("upload", fileId);

    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    if (fs.statSync(destDir).isFile()) {
      fs.unlinkSync(destDir);
      fs.mkdirSync(destDir, { recursive: true });
    }

    const mimetype = req.body.mimeType;
    const fileName = path.join(destDir, req.body.fileName);
    const fileExtension = mimeTypes.extension(mimetype);

    // move file to the specified folder so that we could merge chunks
    // into a single file later
    fs.renameSync(uploadedFileName, fileName);

    const chunksRcvd = fs.readdirSync(destDir).length;
    const totalChunkCount = parseInt(req.body.chunkCount);

    if (chunksRcvd === totalChunkCount) {
      const mergedFilePath = mergeFile(destDir, fileExtension);
      return res.json({
        msg: "success. merged into single file",
        data: mergedFilePath,
      });
    }

    return res.json({ msg: "success. awaiting merge", data: null });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ msg: "something went wrong", data: err.stack || err.message });
  }
});

server.listen(3000, () => console.log(`listening on http://localhost:3000`));
