# How to use extensions in Zinc
## What is an extension in zinc
An extension in Zinc is basicly a costum website that runs inside zinc and can interact with websites just like any other browser extension.    
## Making an extension
to make an extension you have to have to at least have two essential files:
1. manifest.json
2. popup.html

you can find examples of both files in this folder, making the extension itself is just like making any other website.
## importing extensions
to import an extension all you gotta do is upload your folder containing the extension files in the settings page accessed via the button on the top right.

**only import extensions you trust, if anyone has shared an extension with you, make sure to double check it. extensions can run malicious scripts to steal your data or make the site unusable. import at your own risk**
## Other info
right now the extension system is very simple and still in beta, here are some features that we plan on adding:
1. background.js that runs on start
2. zinc://extensions page to manage extensions
3. proxy site interactivity (costum javascript inside proxied page)
