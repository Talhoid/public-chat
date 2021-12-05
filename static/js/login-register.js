document.querySelector('#submitbtn').addEventListener('click', function (event) {
    event.preventDefault();
    event.target.parentElement.classList.add('was-validated');
    if (event.target.parentElement.checkValidity()) {
        console.log(event.target.parentElement.checkValidity() + event.target.parentElement.checkValidity() ? ' valid' : ' invalid')
        event.target.parentElement.submit();
    }
});