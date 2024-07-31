import requests
import sys

if len(sys.argv) < 2 or len(sys.argv[1]) < 2:
    sys.exit(0)
argument = sys.argv[1]
files = []
name = []
for i in argument.split("@"):
    temp = i.split("#")
    name.append(temp[0])
    files.append(temp[1])

for i in range(len(files)):
    url = files[i]
    local_filename = name[i]
    try:
        with requests.get(url, stream=True) as response:
            response.raise_for_status()  # Check if the request was successful
            with open(local_filename, 'wb') as file:
                for chunk in response.iter_content(chunk_size=8192):
                    file.write(chunk)
    except Exception as e:
        print(e)
