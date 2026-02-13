import bcrypt from "bcryptjs";

bcrypt.hash("User@1", 10)
  .then(hash => {
    console.log("Hashed password:");
    console.log(hash);
  })
  .catch(err => {
    console.error("Error:", err);
  });
