document.querySelector('#submitbtn').addEventListener('click', async (event) => {
	event.preventDefault();
	var formData = Object.fromEntries(new FormData(document.querySelector("form")));
	if (event.target.parentElement.checkValidity()) {
		var formResponse = await fetch(document.querySelector("form").action, {
			method: document.querySelector("form").method,
			body: JSON.stringify(formData),
			headers: {
				"content-type": "application/json"
			}
		});
		if (!formResponse.ok) {
			formResponse = await formResponse.json();
			document.getElementById("error").textContent = formResponse.message;
		} else {
			location.href = "/";
		}
	}
});