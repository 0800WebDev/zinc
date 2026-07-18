window.zinc = {

    tabs: {

        async executeScript(code) {

            if (window.parent?.runInActiveFrame) {
                return window.parent.runInActiveFrame(code);
            }

            return false;

        }

    }

};
