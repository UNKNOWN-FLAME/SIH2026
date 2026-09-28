import urllib.request, json
state = json.loads(urllib.request.urlopen('http://127.0.0.1:8001/state').read().decode())
print(json.dumps(state, indent=2))
