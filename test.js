function parseArguments(input) {
    const args = input.match(/-\w+=\S+/g);
    const parameter = {};
    
    if (args) {
        args.forEach(arg => {
            const [key, value] = arg.split('=');
            if (key && value) {
                parameter[key.replace('-', '').toLowerCase()] = value;
            }
        })
    }
    return parameter;
}