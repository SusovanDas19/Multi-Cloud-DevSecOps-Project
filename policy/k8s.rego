package main

deny[msg] {
  input.kind == "Deployment"
  not input.spec.template.spec.containers[0].livenessProbe
  msg = "Containers must have a livenessProbe configured"
}

deny[msg] {
  input.kind == "Deployment"
  input.spec.template.spec.containers[0].imagePullPolicy != "Always"
  msg = "imagePullPolicy must be set to Always"
}
