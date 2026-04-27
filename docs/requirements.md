Task Description
Expected delivery time: 7 days

Task scope and expectations
Your task is to write a food delivery service API.
You need to write an API for a simple application where users can order meals from restaurants.
The user must be able to create an account and log in using the API.
Implement 2 roles with different permission levels:
Customer: Can see all restaurants and place orders from them.
Restaurant Owner: Can CRUD restaurants and meals.
Each user can have only one account (the user is identified by an email).
A restaurant should have a name and description of the type of food they serve.
A meal should have a name, description, and price.
Orders include a list of meals, date, total amount, and status.
An order should be placed for a single restaurant only, but it can have multiple meals.
Orders can also contain a custom tip amount and can reference a coupon for a percentage discount.
There is no need to handle payment of any kind or even to simulate payment handling.
Restaurant owners and customers can change the order status respecting below flow and permissions:
Placed: Once a customer places an order.
Canceled: If the customer or restaurant owner cancels the order.
Processing: Once the restaurant owner starts to make the meals.
In Route: Once the meal is finished and the restaurant owner marks it's on the way.
Delivered: Once the restaurant owner receives information that the meal was delivered by their staff.
Received: Once the customer receives the meal and marks it as received.
Orders should have a history of the date and time of the status change.
Customers should be able to browse their order history and view updated order status.
Customers and restaurant owners should be able to see a list of the orders.

Implement Administrator Role
An administrator who can CRUD users (of any role), restaurants, and meals and change all user/restaurant/meal information, including blocking.
The application should include one built-in admin account that cannot be deleted.
REST/GraphQL API. Make it possible to perform all user and admin actions via the API, including authentication.
In any case, you should be able to explain how a REST/GraphQL API works and demonstrate that by creating functional tests that use the REST/GraphQL Layer directly.
Please be prepared to use REST/GraphQL clients like Postman, cURL, etc., for this purpose.
