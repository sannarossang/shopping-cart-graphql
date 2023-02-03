const path = require("path");
const fsPromises = require("fs/promises");
const {
  fileExists,
  readJsonFile,
  deleteFile,
} = require("../utils/fileHandling");
const {
  GraphQLError,
  responsePathAsArray,
  isTypeSystemDefinitionNode,
} = require("graphql");
const crypto = require("crypto");
const axios = require("axios").default;

const productDirectory = path.join(__dirname, "..", "data", "products");
const shoppingCartDirectory = path.join(
  __dirname,
  "..",
  "data",
  "shoppingCarts"
);

exports.resolvers = {
  Query: {
    getShoppingCartById: async (_, args) => {
      const shoppingCartId = args.shoppingCartId;
      let shoppingCartFilePath = path.join(
        shoppingCartDirectory,
        `${shoppingCartId}.json`
      );
      const shoppingCartExists = await fileExists(shoppingCartFilePath);
      if (!shoppingCartExists)
        return new GraphQLError("That shoppingcart does not exist!");
      const shoppingCartdata = await readJsonFile(shoppingCartFilePath);
      return shoppingCartdata;
    },

    getProductById: async (_, args) => {
      const productId = args.productId;
      const productFilePath = path.join(productDirectory, `${productId}.json`);
      const productExist = await fileExists(productFilePath);
      if (!productExist)
        return new GraphQLError("That product does not exists!");
      const productData = await readJsonFile(productFilePath);
      return productData;
    },
  },

  Mutation: {
    createShoppingCart: async () => {
      const newShoppingCart = {
        id: crypto.randomUUID(),
        items: [],
        totalPrice: 0,
      };

      let filePath = path.join(
        shoppingCartDirectory,
        `${newShoppingCart.id}.json`
      );
      let idExists = true;
      while (idExists) {
        const exists = await fileExists(filePath);
        console.log(exists, newShoppingCart.id);
        if (exists) {
          newShoppingCart.id = crypto.randomUUID();
          filePath = path.join(
            shoppingCartDirectory,
            `${newShoppingCart.id}.json`
          );
        }
        idExists = exists;
      }

      await fsPromises.writeFile(filePath, JSON.stringify(newShoppingCart));

      return newShoppingCart;
    },

    addItemToShoppingCart: async (_, args) => {
      const { shoppingCartId, quantity, productId } = args;
      const shoppingCartFilePath = path.join(
        shoppingCartDirectory,
        `${shoppingCartId}.json`
      );

      const shoppingCartExist = await fileExists(shoppingCartFilePath);
      if (!shoppingCartExist)
        return new GraphQLError("That shoppingcart does not exist!");

      const shoppingCartData = await readJsonFile(shoppingCartFilePath);

      const productFilePath = path.join(productDirectory, `${productId}.json`);

      const productExist = await fileExists(productFilePath);
      if (!productExist)
        return new GraphQLError("That product does not exist!");

      const productData = await readJsonFile(productFilePath);

      const foundProductInCart = shoppingCartData.items.find(
        (item) => item.id === productId
      );

      if (foundProductInCart !== undefined) {
        foundProductInCart.quantity = foundProductInCart.quantity + quantity;
      } else {
        const newShoppingCartItem = {
          id: productData.id,
          name: productData.name,
          unitPrice: productData.unitPrice,
          quantity: quantity,
        };
        shoppingCartData.items.push(newShoppingCartItem);
      }
      shoppingCartData.totalPrice = sumPrice(shoppingCartData.items);
      await fsPromises.writeFile(
        shoppingCartFilePath,
        JSON.stringify(shoppingCartData)
      );
      return shoppingCartData;
    },

    deleteShoppingCartItem: async (_, args) => {
      const { shoppingCartId, shoppingCartItemId, quantity } = args;

      const shoppingCartFilePath = path.join(
        shoppingCartDirectory,
        `${shoppingCartId}.json`
      );
      const shoppingCartExist = await fileExists(shoppingCartFilePath);
      if (!shoppingCartExist) {
        return new GraphQLError("That shoppingcart does not exist!");
      }
      const shoppingCartData = await readJsonFile(shoppingCartFilePath);

      const foundProductInCart = shoppingCartData.items.find(
        (item) => item.id === shoppingCartItemId
      );

      if (foundProductInCart !== undefined) {
        const index = shoppingCartData.items.indexOf(foundProductInCart);
        if (quantity === undefined) {
          shoppingCartData.items.splice(index, 1);
        } else {
          if (foundProductInCart.quantity <= quantity) {
            shoppingCartData.items.splice(index, 1);
          } else
            shoppingCartData.items[index].quantity =
              foundProductInCart.quantity - quantity;
        }
        shoppingCartData.totalPrice = sumPrice(shoppingCartData.items);

        await fsPromises.writeFile(
          shoppingCartFilePath,
          JSON.stringify(shoppingCartData)
        );
      } else {
        return new GraphQLError("That product does not exist!");
      }
      return shoppingCartData;
    },

    deleteShoppingCart: async (_, args) => {
      const { shoppingCartId } = args;

      const shoppingCartFilePath = path.join(
        shoppingCartDirectory,
        `${shoppingCartId}.json`
      );
      const shoppingCartExists = await fileExists(shoppingCartDirectory);
      if (!shoppingCartExists)
        return new GraphQLError("That cart does not exist");

      try {
        await deleteFile(shoppingCartFilePath);
      } catch (error) {
        return {
          deletedId: shoppingCartId,
          success: false,
        };
      }
      return {
        deletedId: shoppingCartId,
        success: true,
      };
    },
  },
};

function sumPrice(items) {
  let sum = 0;
  for (let x of items) {
    sum = sum + x.quantity * x.unitPrice;
  }
  return sum;
}
